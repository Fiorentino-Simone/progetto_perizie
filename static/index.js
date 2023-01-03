"use strict";

const URL = "https://maps.googleapis.com/maps/api"

window.onload = async function () {
    /*global google*/
    try {
        await createGoogleMaps();
    }
    catch (e) {
        return console.log("ERRORE" + e);
    }

    /**********EVENTS ****************/
    let navitems = $(".nav-item");
    let dropdown = $(".dropdown");
    navitems.on("click", changeColor);
    dropdown.on("click", changeColor);

    let btnLogout = $("#btnLogout");
    btnLogout.on("click", logout);

    //getUsers();


    let wrapper = $("#map")[0];
    //map with reasolve promise
    convertiIndirizzo();

    /**********FUNCTIONS AND REQUESTS ****************/
    function changeColor() {
        navitems.children("a").removeClass("active");
        dropdown.children("a").removeClass("active");
        $(this).children("a").addClass("active");
    }


    function logout() {
        localStorage.removeItem("token")
        window.location.href = "login.html"
    }

    function getUsers() {
        let request = inviaRichiesta("GET", "/api/users");
        request.fail(errore);
        request.done((data) => {
            console.log(data);
        });
    }

    function convertiIndirizzo() {
        let address = "Via San Michele 68, Fossano"; //oppure preso da un input
        let geocoder = new google.maps.Geocoder();
        geocoder.geocode({
            "address": address,
        }, function (results, status) {
            if (status != google.maps.GeocoderStatus.OK) alert("INDIRIZZO NON VALIDO");
            else disegnaMappa(results[0]);
        });
    }

    function disegnaMappa(results) {
        let mapsOption = {
            "center": results.geometry.location,
            "zoom": 16,

            disableDefaultUI:true,   //cosa che posso aggiungere in seguito manualmente

            // Pulsanti switch ROADMAP/TERRAIN oppure HYBRID/SATELLITE (senza etichette)
            mapTypeControl: false,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR, // default
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,  // verticale
                position: google.maps.ControlPosition.TOP_LEFT,
            },

            // Omino StreetView (che ha senso solo per le ROADMAP)
            streetViewControl: false,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER //dove si vuole
            },

            // Pulsanti di zoom + -
            zoomControl: true,
            zoomControlOptions: {
                // style: deprecata,
                position: google.maps.ControlPosition.RIGHT_CENTER
            },


            //Pulsante FullScreen
            fullscreenControl: false,
            fullscreenOptions: {
                // Non ha opzioni, utilizza una posizione fissa in alto a destra
            },

            // Visualizza nella riga di stato in basso a destra un fattore di scala
            // per default è disabilitato
            scaleControl: false,
            scaleControlOptions: {
                // Non ha opzioni
            }
        }
        let map = new google.maps.Map(wrapper, mapsOption);

        let markerOption = {
            "map": map,
            "position": results.geometry.location,
            "title": results.formatted_address
        }

        let marcatore = new google.maps.Marker(markerOption);

        let infoWindowOptions = {
            "content":
                `<div id="infoWindow">
				<h2> IIS VALLAURI </h2>
				<p>
					<span>Indirizzo: </span><br>
					<span>${results.formatted_address}</span>
				</p>
				<p>
					<span>Coordinate GPS: </span><br>
					<span>${results.geometry.location.toString()}</span>
				</p>
			</div>`,
            "width": 150
        }
        let infoWindow = new google.maps.InfoWindow(infoWindowOptions);

        marcatore.addListener("click", function () {
            infoWindow.open(map, marcatore);
        })
    }
}

function createGoogleMaps() {
    let promise = new Promise(function (resolve, reject) {
        // creazione dinamica del CDN di accesso alle google maps
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = URL + '/js?v=3&key=' + MAP_KEY;
        document.body.appendChild(script);
        script.onload = resolve; //evento che si verifica quando si carica lo script
        script.onerror = reject;
    })
    return promise;
}