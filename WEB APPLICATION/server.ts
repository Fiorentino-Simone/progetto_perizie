"use strict";

// import
import http from "http";
import https from "https";
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
import jwtDecode from "jwt-decode";
import { google } from "googleapis";
const nodemailer = require("nodemailer");

// config
const app = express();
const HTTP_PORT = process.env.PORT || 1337;
const HTTPS_PORT = 1338;
dotenv.config({ path: ".env" });
const DBNAME = "ProgettoPerizie";
const CONNECTION_STRING = process.env.connectionString;
cloudinary.v2.config(JSON.parse(process.env.cloudinary as string));

const DURATA_TOKEN = 3600; // offset in secondi rispetto alla data corrente dove poi mi richiederà di fare il login
const OAuth2 = google.auth.OAuth2;
const OAuth2Client = new OAuth2(
  process.env.client_id_google,
  process.env.client_secret_google
);

//gestione CORS
const privateKey: string = process.env.PRIVATE_KEY as string;
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const privateKeyCert = fs.readFileSync("keys/privateKey.pem", "utf8");
const credentials = { key: privateKeyCert, cert: certificate };

const whitelist = [
  "http://my-crud-server.herokuapp.com ", //inserire il nostro sito pubblicato su render/heroku
  "https://my-crud-server.herokuapp.com ",
  "http://localhost:1337",
  "https://localhost:1338",
  "https://192.168.1.29:1338",
  "http://192.168.1.29:1337",
  "https://cordovaapp",
  "http://localhost:4200",
];

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (!origin) return callback(null, true);
    if (whitelist.indexOf(origin) === -1) {
      var msg = `The CORS policy for this site does not  allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    } else return callback(null, true);
  },
  credentials: true,
};

// ***************************** Avvio ****************************************
let httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  init();
});

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
  console.log(
    "Server in ascolto sulle porte HTTP:" + HTTP_PORT + ", HTTPS:" + HTTPS_PORT
  );
});

let paginaErrore: string = "";
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
    let remember30days = req.body.remember30days;
    let connection = new MongoClient(CONNECTION_STRING as string);
    connection
      .connect()
      .then((client: MongoClient) => {
        const collection = client.db(DBNAME).collection("Utenti");
        let regex = new RegExp(`^${req.body.email}$`, "i"); // case insensitive
        collection
          .findOne({ email: regex })
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
                      let token = createToken(dbUser, remember30days);
                      //inseriamo il token o nei cookie o nel HTTP header authorization (scelta preferita)
                      res.setHeader("Authorization", token);
                      res.setHeader(
                        "Access-Control-Expose-Headers",
                        "Authorization"
                      ); //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
                      res.send({ ris: "ok" }); //il client riceve il token dall'intestazione (sia il codice 200 che il token)
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
      .catch((err: Error) => {
        res.status(503);
        res.send("Database service unavailable");
      });
  }
);

function createToken(user: any, remember30days?: boolean) {
  //legge la data corrente
  let time: any = new Date().getTime() / 1000; // prendo i millisecondi e poi in secondi
  let now: number = parseInt(time); //converto in intero
  let exp;
  if (typeof remember30days !== "undefined") {
    if (remember30days) exp = now + 30 * 24 * 60 * 60; // 30 giorni
    else exp = now + DURATA_TOKEN; // 1 ora
  } else {
    // guardare nel payload se c'è il campo remember30days
    remember30days = user.remember30days;
    if (user.remember30days) exp = now + 30 * 24 * 60 * 60; // 30 giorni
    else exp = now + DURATA_TOKEN; // 1 ora
  }
  let payload = {
    iat: user.iat || now, //se esiste già il token, allora prendo la data di creazione, altrimenti la data corrente
    exp: exp, // scade in tot secondi
    _id: user._id,
    email: user.email,
    remember30days: user.remember30days || remember30days,
  };
  let token = jwt.sign(payload, privateKey); //usiamo come privateKey una qualsiasi stringa (noi usiamo una chiave privata RSA per firmare il token)
  console.log("Creato nuovo token: " + token);
  return token;
}

// 8. gestione login con google
app.post(
  "/api/googleLogin",
  function (req: Request, res: Response, next: NextFunction) {
    let token = req.body.token;
    //decodifico il token con jwt_decode
    let decodedToken: any = jwtDecode(token);
    let connection = new MongoClient(CONNECTION_STRING as string);
    connection
      .connect()
      .then((client: MongoClient) => {
        const collection = client.db(DBNAME).collection("Utenti");
        let regex = new RegExp(`^${decodedToken.email}$`, "i"); // case insensitive
        collection
          .findOne({ email: regex })
          .then((dbUser: any) => {
            if (!dbUser) {
              //per ora andiamo a dire che se non sei dentro la lista dei dipendenti non puoi entrare (per evitare che qualcuno si registri con un account google)
              res.status(401);
              res.send("Non sei autorizzato a registrarti");
            } else {
              //aggiorno il token
              let token = createToken(dbUser);
              res.setHeader("Authorization", token);
              res.setHeader("Access-Control-Expose-Headers", "Authorization"); //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
              res.send({ ris: "ok" }); //
            }
          })
          .catch((err: Error) => {
            res.status(500);
            res.send("Query error " + err.message);
            console.log(err.stack);
          });
      })
      .catch((err: Error) => {
        res.status(503);
        res.send("Database service unavailable");
      });
  }
);

app.post("/api/forgotPassword", (req: any, res: any, next: any) => {
  let connection = new MongoClient(CONNECTION_STRING as string);
  connection.connect().then((client: MongoClient) => {
    const collection = client.db(DBNAME).collection("Utenti");
    let email = req.body.email;
    collection
      .findOne({
        email: email,
      })
      .then((result: any) => {
        if (result) {
          //update password temporanea
          //1234 in bycript
          let passwordTemp = bcrypt.hashSync("1234", 10);
          collection
            .updateOne(
              {
                email: email,
              },
              { $set: { password: passwordTemp } }
            )
            .then((result: any) => {
              console.log("Password temporanea aggiornata");
              //send email
              OAuth2Client.setCredentials({
                refresh_token: process.env.refresh_token_google,
              });
              const accessToken = OAuth2Client.getAccessToken();
              const transport = nodemailer.createTransport({
                service: "gmail",
                auth: {
                  type: "OAuth2",
                  user: process.env.email,
                  clientId: process.env.client_id_google,
                  clientSecret: process.env.client_secret_google,
                  refreshToken: process.env.refresh_token_google,
                  accessToken: accessToken,
                },
              });

              const mailOptions = {
                from: process.env.email,
                to: email,
                subject: "Recupero password Rilievi & Perizie",
                html: `<h3>Recupero password</h3>
                  <p>La tua password temporanea è: 1234</p>
                  <p>Per favore, cambiala al più presto !!</p>`,
              };

              transport.sendMail(mailOptions, function (err: any, info: any) {
                if (err) {
                  res.status(500);
                  res.send("Error send email " + err.message);
                  console.log(err.stack);
                } else {
                  res.send({ ris: "ok" });
                }
              });
            })
            .catch((err: Error) => {
              res.status(500);
              res.send("Query error " + err.message);
              console.log(err.stack);
            });
        } else {
          res.status(404);
          res.send("Email not found");
        }
      })
      .catch((err: Error) => {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      });
  });
});

// 10. Controllo del Token
app.use("/api/", (req: any, res: any, next: any) => {
  let token = req.headers["authorization"]; //accedo al token
  if (!token) {
    //se non c'è il token --> primo accesso
    res.status(403);
    res.send("Token mancante"); //non autorizzato
  } else {
    //verifico il token (se è valido o meno)
    jwt.verify(token, privateKey, (err: any, payload: any) => {
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

// 11. Apertura della connessione
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

app.get("/api/users", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  //prendiamo l'utente dal token
  //let user = req["payload"];
  //let id = new ObjectId(user._id); //ricordo serve l'ObjectId per fare la query di selezione
  collection.find().toArray((err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      res.send(result);
    }
    req["connessione"].close();
  });
});

app.post("/api/perizie", (req: any, res: Response, next: NextFunction) => {
  let ordering = req.body.ordering;
  let codOperator = req.body.codOperator;
  let querySort: any = {};
  let query: any = {};
  if (ordering == null) querySort = {};
  else {
    for (const item of ordering) {
      if (item != "distance") querySort[item] = -1;
    }
  }
  console.log(querySort);
  if (codOperator != null) query = { codOperator: codOperator };
  else query = {};
  console.log(query);
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  collection
    .find(query)
    .sort(querySort)
    .toArray((err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    });
});

app.get("/api/operators", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  collection.find({}).toArray((err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      res.send(result);
    }
    req["connessione"].close();
  });
});

app.get("/api/checkAdmin", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  let user = req["payload"];
  console.log(user);
  let id = new ObjectId(user._id);
  collection.findOne({ _id: id }, (err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      res.send(result);
    }
    req["connessione"].close();
  });
});

app.get("/api/totDipendenti", (req: any, res: Response, next: NextFunction) => {
  //count del numero di tutti gli utenti
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  collection.countDocuments({}, (err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      res.send(JSON.stringify(result));
    }
    req["connessione"].close();
  });
});

app.get(
  "/api/totPerizieSettimanali",
  (req: any, res: Response, next: NextFunction) => {
    //send le perizie fatte in una settimana
    let collection = req["connessione"].db(DBNAME).collection("Rilievi");
    //usare la gestione della data in questo formato: YYYY-MM-DD
    let today = new Date();
    let lastWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 7
    );
    let date = new Date(lastWeek),
      mnth = ("0" + (date.getMonth() + 1)).slice(-2),
      day = ("0" + date.getDate()).slice(-2);
    let dateQuery = [date.getFullYear(), mnth, day].join("-");
    collection.countDocuments(
      { dateAdded: { $gte: dateQuery } },
      (err: any, result: any) => {
        if (err) {
          res.status(500);
          res.send("Query error " + err.message);
          console.log(err.stack);
        } else {
          res.send(JSON.stringify(result));
        }
        req["connessione"].close();
      }
    );
  }
);

app.get(
  "/api/mediaValutazioniPerizie",
  (req: any, res: Response, next: NextFunction) => {
    //send la media delle valutazioni delle perizie
    let collection = req["connessione"].db(DBNAME).collection("Rilievi");
    collection
      .aggregate([{ $group: { _id: null, media: { $avg: "$score" } } }])
      .toArray((err: any, result: any) => {
        if (err) {
          res.status(500);
          res.send("Query error " + err.message);
          console.log(err.stack);
        } else {
          res.send(result);
        }
        req["connessione"].close();
      });
  }
);

app.post(
  "/api/getInformationDipendente",
  (req: any, res: Response, next: NextFunction) => {
    let collection = req["connessione"].db(DBNAME).collection("Utenti");
    let codOperator = req.body.operator;
    collection.findOne(
      { codOperator: codOperator },
      { projection: { _id: 0, password: 0 } },
      (err: any, result: any) => {
        if (err) {
          res.status(500);
          res.send("Query error " + err.message);
          console.log(err.stack);
        } else {
          res.send(result);
        }
        req["connessione"].close();
      }
    );
  }
);

app.post("/api/getChart", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  let codOperator = req.body.operator;
  collection
    .find({ codOperator: codOperator })
    .toArray((err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        //set an array label with the date of the perizie
        let label = [];
        let data = [];
        let backgroundColor = [];
        for (let i = 0; i < result.length; i++) {
          label.push(result[i].dateAdded);
          data.push(result[i].score);
          backgroundColor.push(generaColore());
        }
        let chart = {
          label: label,
          data: data,
          backgroundColor: backgroundColor,
        };
        res.send(chart);
      }
      req["connessione"].close();
    });
});

app.post(
  "/api/editDipendente",
  (req: any, res: Response, next: NextFunction) => {
    let collection = req["connessione"].db(DBNAME).collection("Utenti");
    let codOperator = req.body.data.codOperator;
    collection.replaceOne(
      { codOperator: codOperator },
      req.body.data,
      (err: any, result: any) => {
        if (err) {
          res.status(500);
          res.send("Query error " + err.message);
          console.log(err.stack);
        } else {
          res.send(result);
        }
        req["connessione"].close();
      }
    );
  }
);

app.post("/api/searchPerizie", (req: any, res: any, next: any) => {
  let searchInput = req.body.search;
  let codOperator = req.body.codOperator;
  let query = {};
  if (codOperator == null) query = {};
  else query = { codOperator: codOperator };
  //match a title or a description with includes the searchInput, case insensitive, with the codOperator condition
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  collection
    .find({
      $and: [
        query,
        {
          $or: [
            { title: { $regex: searchInput, $options: "i" } },
            { description: { $regex: searchInput, $options: "i" } },
          ],
        },
      ],
    })
    .toArray((err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    });
});

app.post("/api/filterPerizie", (req: any, res: any, next: any) => {
  let filter = req.body.parameters;
  console.log(filter);
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  collection
    .find(filter, { projection: { _id: 0 } })
    .toArray((err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    });
});

app.patch("/api/editPerizia", (req: any, res: any, next: any) => {
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  let id = req.body.id;
  let editValues = req.body.parameters;
  console.log("editValues: ", editValues);
  collection.updateOne(
    { _id: new ObjectId(id) },
    { $set: editValues },
    (err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    }
  );
});

app.post("/api/deleteDipendente", (req: any, res: any, next: any) => {
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  let codOperator = req.body.operator;
  collection.deleteOne(
    { codOperator: codOperator },
    (err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    }
  );
});

app.post("/api/likedPerizia", (req: any, res: any, next: any) => {
  let idPerizia = req.body.idPerizia;
  let codOperator = req.body.codOperator;
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  collection.updateOne(
    { codOperator: codOperator },
    { $push: { likedPerizie: idPerizia } },
    (err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    }
  );
});

app.post("/api/dislikedPerizia", (req: any, res: any, next: any) => {
  let idPerizia = req.body.idPerizia;
  let codOperator = req.body.codOperator;
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  collection.updateOne(
    { codOperator: codOperator },
    { $pull: { likedPerizie: idPerizia } },
    (err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    }
  );
});

app.post("/api/base64Cloudinary", (req: any, res: any, next: any) => {
  if (!req.body.description || !req.body.img) {
    res.status(404);
    res.send("File or username is missed");
  } else {
    cloudinary.v2.uploader
      .upload(req.body.img, { folder: "my-images", use_filename: true })
      .then((result: UploadApiResponse) => {
        //how to take the name of the file
        let response = {
          url: result.secure_url,
          description: req.body.description,
        };
        res.send(JSON.stringify(response));
      })
      .catch((err: any) => {
        res.status(500);
        res.send("Error upload file to Cloudinary. Error: " + err.message);
      });
  }
});

app.post("/api/insertPerizia", (req: any, res: any, next: any) => {
  let collection = req["connessione"].db(DBNAME).collection("Rilievi");
  let perizia = req.body.perizia;
  collection.insertOne(perizia, (err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      res.send(result);
    }
    req["connessione"].close();
  });
});

app.post("/api/editUtente", (req: any, res: any, next: any) => {
  let collection = req["connessione"].db(DBNAME).collection("Utenti");
  let parameters = req.body.obj;
  //take the pass into parameters and encrypt it with bcrypt
  let pwdBcrypt = bcrypt.hashSync(parameters.password, 10);
  parameters.password = pwdBcrypt;
  collection.updateOne(
    { codOperator: parameters.codOperator },
    { $set: parameters },
    (err: any, result: any) => {
      if (err) {
        res.status(500);
        res.send("Query error " + err.message);
        console.log(err.stack);
      } else {
        res.send(result);
      }
      req["connessione"].close();
    }
  );
});

app.post("/api/contattami", (req: any, res: any, next: any) => {
  let collection = req["connessione"].db(DBNAME).collection("Contattami");
  let contattami = req.body.obj;
  collection.insertOne(contattami, (err: any, result: any) => {
    if (err) {
      res.status(500);
      res.send("Query error " + err.message);
      console.log(err.stack);
    } else {
      //send email
      OAuth2Client.setCredentials({
        refresh_token: process.env.refresh_token_google,
      });
      const accessToken = OAuth2Client.getAccessToken();
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: process.env.email,
          clientId: process.env.client_id_google,
          clientSecret: process.env.client_secret_google,
          refreshToken: process.env.refresh_token_google,
          accessToken: accessToken,
        },
      });

      const mailOptions = {
        from: process.env.email,
        to: contattami.email,
        subject: "Richiesta di contatto da parte del team di Rilievi&Perizie",
        html: `<h3>Richiesta di contatto</h3>
          <p>Nome: ${contattami.nome}</p>
          <p>Cognome: ${contattami.cognome}</p>
          <p>Email: ${contattami.email}</p>
          <p>Messaggio: ${contattami.messaggio}</p>
          <p>Presto verrà contattato</p>
          <p>Saluti</p>
          <p>Il team di Rilievi&Perizie</p>`,
      };

      transport.sendMail(mailOptions, function (err: any, info: any) {
        if (err) {
          res.status(500);
          res.send("Error send email " + err.message);
          console.log(err.stack);
        } else {
          res.send({ ris: "ok" });
        }
      });
      res.send(result);
    }
    req["connessione"].close();
  });
});

app.post(
  "/api/googleRegistration",
  function (req: Request, res: Response, next: NextFunction) {
    let token = req.body.token;
    //decodifico il token con jwt_decode
    let decodedToken: any = jwtDecode(token);
    let connection = new MongoClient(CONNECTION_STRING as string);
    connection
      .connect()
      .then((client: MongoClient) => {
        const collection = client.db(DBNAME).collection("Utenti");
        let regex = new RegExp(`^${decodedToken.email}$`, "i"); // case insensitive
        collection
          .findOne({ email: regex })
          .then((dbUser: any) => {
            if (!dbUser) {
              //creo il nuovo utente
              let codOperator: string = creaCodiceOperatore();
              let pwdBcrypt = bcrypt.hashSync(decodedToken.jti, 10); //trasformo la password in hash (jti è un campo del token di Google)
              let newUser = {
                codOperator: codOperator,
                email: decodedToken.email,
                password: pwdBcrypt,
                phone: "",
                admin: false,
                nominativo: decodedToken.name,
                imageUtente: decodedToken.picture,
              };
              collection
                .insertOne(newUser)
                .then((ris: any) => {
                  //creo il token e lo invio
                  let token = createToken(newUser, false); //creo il mio token e non uso quello di google siccome lo uniformo a quello che uso per la registrazione normale
                  //andiamo a inviare una mail con la password generata
                  sendEmail(
                    decodedToken.email,
                    decodedToken.name,
                    decodedToken.jti
                  );
                  //inseriamo il token o nei cookie o nel HTTP header authorization (scelta preferita)
                  res.setHeader("Authorization", token);
                  res.setHeader(
                    "Access-Control-Expose-Headers",
                    "Authorization"
                  ); //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
                  res.send({ ris: "ok" }); //il client riceve il token dall'intestazione (sia il codice 200 che il token)
                })
                .catch((err: Error) => {
                  res.status(500);
                  res.send("Query error " + err.message);
                  console.log(err.stack);
                })
                .finally(() => {
                  client.close();
                });
            } else {
              //aggiorno il token
              let token = createToken(dbUser);
              res.setHeader("Authorization", token);
              res.setHeader("Access-Control-Expose-Headers", "Authorization"); //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
              res.send({ ris: "ok" }); //
            }
          })
          .catch((err: Error) => {
            res.status(500);
            res.send("Query error " + err.message);
            console.log(err.stack);
          });
      })
      .catch((err: Error) => {
        res.status(503);
        res.send("Database service unavailable");
      });
  }
);

app.post("/api/registration", (req: any, res: any, next: any) => {
  let connection = new MongoClient(CONNECTION_STRING as string);
  connection
    .connect()
    .then((client: MongoClient) => {
      const collection = client.db(DBNAME).collection("Utenti");
      let regex = new RegExp(`^${req.body.email}$`, "i"); // case insensitive
      collection
        .findOne({ email: regex })
        .then((dbUser: any) => {
          if (dbUser) {
            res.status(401); // user o password non validi
            res.send("User already exists");
          } else {
            //creo il nuovo utente
            let codOperator: string = creaCodiceOperatore();
            let pwdBcrypt = bcrypt.hashSync(req.body.password, 10); //trasformo la password in hash
            let newUser = {
              codOperator: codOperator,
              email: req.body.email,
              password: pwdBcrypt,
              phone: req.body.phone,
              admin: false,
              nominativo: req.body.nominativo,
            };
            collection
              .insertOne(newUser)
              .then((ris: any) => {
                //creo il token e lo invio
                let token = createToken(newUser, false);
                //inseriamo il token o nei cookie o nel HTTP header authorization (scelta preferita)
                sendEmail(
                  req.body.email,
                  req.body.nominativo,
                  req.body.password
                );
                res.setHeader("Authorization", token);
                res.setHeader("Access-Control-Expose-Headers", "Authorization"); //per far vedere il token al client (extra-domain, esempio sito web e app in dominio diverso)
                res.send({ ris: "ok" }); //il client riceve il token dall'intestazione (sia il codice 200 che il token)
              })
              .catch((err: Error) => {
                res.status(500);
                res.send("Query error " + err.message);
                console.log(err.stack);
              })
              .finally(() => {
                client.close();
              });
          }
        })
        .catch((err: Error) => {
          res.status(500);
          res.send("Query error " + err.message);
          console.log(err.stack);
        });
    })
    .catch((err: Error) => {
      res.status(503);
      res.send("Database service unavailable");
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

/*********************** HELPED FUNCTIONS ****************************************/
function generaColore() {
  let R = generaNumero(0, 255);
  let G = generaNumero(0, 255);
  let B = generaNumero(0, 255);
  return `rgba(${R}, ${G}, ${B}, 0.8)`;
}

function generaNumero(a: any, b: any) {
  return Math.floor((b - a + 1) * Math.random()) + a;
}

function sendEmail(to: any, name: any, password: any) {
  OAuth2Client.setCredentials({
    refresh_token: process.env.refresh_token_google,
  });
  const accessToken = OAuth2Client.getAccessToken();
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.email,
      clientId: process.env.client_id_google,
      clientSecret: process.env.client_secret_google,
      refreshToken: process.env.refresh_token_google,
      accessToken: accessToken,
    },
  });

  const mailOptions = {
    from: "Perizie & Rilievi <" + process.env.email + ">",
    to: to,
    subject: "Benvento su Perizie & Rilievi",
    html: `<h1>Benvenuto ${name}!</h1>
      <p>La tua password è: ${password}</p>
      <p>Per favore, non dimenticarla!</p>
      <p>Il team di Perizie & Rilievi</p>`,
  };

  transport.sendMail(mailOptions, function (error: any, info: any) {
    if (error) {
      console.log("ERRORE INVIO MAIL : ", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

function creaCodiceOperatore() {
  //4 lettere maiuscole casuali + 4 numeri casuali
  let codice = "";
  for (let i = 0; i < 4; i++) {
    let lettera = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    codice += lettera;
  }
  for (let i = 0; i < 4; i++) {
    let numero = Math.floor(Math.random() * 10);
    codice += numero;
  }
  return codice as string;
}
