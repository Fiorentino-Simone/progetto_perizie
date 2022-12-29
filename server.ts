"use strict";

// import
import http from "http";
import fs from "fs";
import express from "express"; // @types/express
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors"; // @types/cors
import fileUpload, { UploadedFile } from "express-fileupload";
import cloudinary, { UploadApiResponse } from "cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// config
const app = express();
const HTTP_PORT = process.env.PORT || 1337;
dotenv.config({ path: ".env" });
const DBNAME = "MongoDB_Esercizi";
const CONNECTION_STRING = process.env.connectionString;
cloudinary.v2.config(JSON.parse(process.env.cloudinary as string));
const corsOptions = {
  origin: function (origin: any, callback: any) {
    return callback(null, true);
  },
  credentials: true,
};
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const DURATA_TOKEN = 50; // offset in secondi rispetto alla data corrente dove poi mi richiederà di fare il login

// ***************************** Avvio ****************************************
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, function () {
  init();
  console.log("Server HTTP in ascolto sulla porta " + HTTP_PORT);
});

let paginaErrore:string = "";
function init() {
  fs.readFile("./static/error.html", function (err, data) {
    if (!err) paginaErrore = data.toString();
    else paginaErrore = "<h1>Risorsa non trovata</h1>";
  });
}

/* *********************** (Sezione 2) Middleware ********************* */
// 1. Request log
app.use("/", function (req, res, next) {
  console.log("** " + req.method + " ** : " + req.originalUrl);
  next();
});

// 2 - risorse statiche
app.use("/", express.static("./static"));

// 3 - lettura dei parametri post
app.use("/", express.json({ limit: "20mb" }));
app.use("/", express.urlencoded({ extended: true, limit: "20mb" }));

// 4 - binary upload
app.use(
  "/",
  fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 }, // 20*1024*1024 // 20 M
  })
);

// 5 - log dei parametri
app.use("/", function (req, res, next) {
  if (Object.keys(req.query).length > 0)
    console.log("        Parametri GET: ", req.query);
  if (Object.keys(req.body).length != 0)
    console.log("        Parametri BODY: ", req.body);
  next();
});

// 6. cors
app.use("/", cors(corsOptions));

// 7. gestione login
app.post(
  "/api/login",
  function (req: Request, res: Response, next: NextFunction) {
    let connection = new MongoClient(CONNECTION_STRING as string);
    connection
      .connect()
      .then((client: MongoClient) => {
        const collection = client.db(DBNAME).collection("Mails");
        let regex = new RegExp(`^${req.body.username}$`, "i"); // case insensitive
        collection
          .findOne({ username: regex })
          .then((dbUser: any) => {
            if (!dbUser) {
              res.status(401); // user o password non validi
              res.send("User not found");
            } else {
              //confronto la password
              bcrypt.compare(
                req.body.password,
                dbUser.password,
                (err: Error, ris: Boolean) => {
                  if (err) {
                    res.status(500);
                    res.send("Errore bcrypt " + err.message);
                    console.log(err.stack);
                  } else {
                    if (!ris) {
                      // password errata
                      res.status(401);
                      res.send("Wrong password");
                    } else {
                      //creo il token e lo invio
                      let token = createToken(dbUser);
                      //inseriamo il token o nei cookie o nel HTTP header authorization (scelta preferita)
                      res.setHeader("Authorization", token);
                      res.setHeader("Access-Control-Expose-Headers", "Authorization") //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
                      res.send({ ris : "ok" }); //il client riceve il token dall'intestazione (sia il codice 200 che il token)
                    }
                  }
                }
              );
            }
          })
          .catch((err: Error) => {
            res.status(500);
            res.send("Query error " + err.message);
            console.log(err.stack);
          })
          .finally(() => {
            client.close();
          });
      })
      .catch((err:Error)=>{
        res.status(503);
        res.send('Database service unavailable');
      });
  }
);


function createToken(user: any) {
  //legge la data corrente
  let time:any = (new Date().getTime())/1000; // prendo i millisecondi e poi in secondi
  let now:number = parseInt(time); //converto in intero
  let payload = {
    "iat" : user.iat || now, //se esiste già il token, allora prendo la data di creazione, altrimenti la data corrente
    "exp" : now + DURATA_TOKEN, // scade in tot secondi
    "_id" : user._id,
    "username" : user.username
  }
  let token = jwt.sign(payload, privateKey); //usiamo come privateKey una qualsiasi stringa (noi usiamo una chiave privata RSA per firmare il token)
  console.log("Creato nuovo token: " + token);
  return token;
}

// 8. gestione Logout

// 9. Controllo del Token
app.use("/api/", (req:any, res:any, next:any) => {
  let token = req.headers["authorization"]; //accedo al token
  if (!token) { //se non c'è il token --> primo accesso
    res.status(403);
    res.send("Token mancante"); //non autorizzato
  } else {
    //verifico il token (se è valido o meno)
    jwt.verify(token, privateKey, (err:any, payload:any) => {
      //lui si calcola la hash del token e la confronta con quella che ha in memoria (se è uguale allora è valido)
      if (err) {
        res.status(403);
        res.send("Token non valido o scaduto");
      } else {
        //se il token è valido, allora aggiorno la data di scadenza
        let newToken = createToken(payload); //creo un nuovo token con la nuova data di scadenza
        //payload ha lo stesso formato di DbUser
        res.setHeader("Authorization", newToken); //aggiorno il token
        res.setHeader("Access-Control-Expose-Headers", "Authorization");
        req["payload"] = payload; //salvo il payload nel request (per poterlo usare nelle altre route) 
        next();
      }
    });
  }
});

// 10. Apertura della connessione
app.use("/api/", function (req: any, res: any, next: NextFunction) {
  let connection = new MongoClient(CONNECTION_STRING as string);
  connection
    .connect()
    .then((client: any) => {
      req["connessione"] = client;
      next();
    })
    .catch((err: any) => {
      let msg = "Errore di connessione al db";
      res.status(503).send(msg);
    });
});

/* ********************* (Sezione 3) USER ROUTES  ************************** */

app.get("/api/elencoMail", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(DBNAME).collection("Mails");
  //prendiamo l'utente dal token
  let user = req["payload"];
  let id = new ObjectId(user._id); //ricordo serve l'ObjectId per fare la query di selezione
  collection.findOne({ _id:  id}, (err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore query " + err.message);
      console.log(err.stack);
      } else {
        if (data) {
          let mails = data.mail;
          mails.reverse();
          res.send(mails);
        } 
        else {
          res.status(404);  
          res.send("Mail non trovate");
        }
        req["connessione"].close();
      }
    });
});

/* ********************** (Sezione 4) DEFAULT ROUTE  ************************* */
// Default route
app.use("/", function (req: any, res: any, next: NextFunction) {
  res.status(404);
  if (req.originalUrl.startsWith("/api/")) {
    res.send("Risorsa non trovata");
    req["connessione"].close();
  } else res.send(paginaErrore);
});

// Gestione degli errori
app.use("/", (err: any, req: any, res: any, next: any) => {
  if (req["connessione"]) req["connessione"].close();
  res.status(500);
  res.send("ERRR: " + err.message);
  console.log("SERVER ERROR " + err.stack);
});
