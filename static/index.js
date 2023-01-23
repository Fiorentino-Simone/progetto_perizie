"use strict";

const URL = "https://maps.googleapis.com/maps/api"

let indexPerizie = 0;
let isAdmin = false;
let mappaID = null;

window.onload = async function () {
    /*global google*/
    try {
        await createGoogleMaps();
    }
    catch (e) {
        return console.log("ERRORE" + e);
    }

    /**********EVENTS ****************/
    let wrapper = $("#map")[0];
    let mapPerizia = $("#mapPerizia")[0];
    let panel = $("#panelPerizia")[0];

    let mapsOption = {
        "center": new google.maps.LatLng(44.5557763, 7.7347183), //posizione di partenza (Vallauri)
        "zoom": 6,

        disableDefaultUI: true,   //cosa che posso aggiungere in seguito manualmente

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

    //#region INIZIALIZZAZIONE
    let operators = {};
    //get operators in async way
    await getOperator();

    let navitems;
    let dropdown;

    let operator = "";
    let likedPerizie = [];

    //#region controlla se l'utente è un admin
    let request = inviaRichiesta("GET", "/api/checkAdmin");
    request.fail(errore);
    request.done((data) => {
        console.log(data);

        //push liked perizie in array
        if (data.likedPerizie) {
            likedPerizie = data.likedPerizie;
        }

        if (data.admin == "false" || data.admin == false) {
            operator = data.codOperator;
            getPerizie(operator);
            isAdmin = false;
        }
        else if (data.admin || data.admin == "true") {
            operator = data.codOperator;
            let li = $("<li>");
            li.addClass("nav-item");
            let a = $("<a>");
            a.addClass("nav-link py-3 px-2");
            a.attr("title", "");
            a.attr("data-bs-toggle", "tooltip");
            a.attr("data-bs-placement", "right");
            a.attr("data-bs-original-title", "AccountHelp");
            let iconify = $("<iconify-icon>");
            iconify.attr("icon", "material-symbols:settings-outline");
            iconify.attr("width", "40");
            iconify.attr("height", "40");
            a.append(iconify);
            li.append(a);
            $("#navBar").append(li);
            a.on("click", viewSectionAdmin);

            $(".userAdmin > img").attr("src", data.imageUtente);

            setInformationDashboard();
            listDipendenti();
            getPerizie();
            isAdmin = true;
        }
        navitems = $(".nav-item");
        dropdown = $(".dropdown");
        navitems.on("click", changeColor);
        dropdown.on("click", changeColor);
    });
    //#endregion

    let btnLogout = $("#btnLogout");
    btnLogout.on("click", logout);

    let containerPerizie = $(".containerPerizie");
    let indexScoreContainer = 0;
    let perizieGlobal;
    let pagination = 1;
    $(".numberPagination").text("Pagina: " + pagination);



    let btnNext = $("#Next");
    let btnPrevious = $("#Previous");
    btnNext.on("click", nextPagePerizie);
    btnPrevious.on("click", previousPagePerizie);


    let btnCheks = $(".btn-check");
    btnCheks.on("click", orderPerizie);

    let mapSection = $("#mapSection");
    mapSection.on("click", viewMap);

    let btnSearch = $("#btnSearch");
    btnSearch.on("click", searchPerizie);

    $(document).on("keydown", function (event) {
        if (event.keyCode == 13) searchPerizie();
    });

    let btnFilter = $("#btnFilter");
    btnFilter.on("click", filterPerizie);

    let likedSection = $("#likedSection");
    likedSection.on("click", viewLikedPerizie);

    //#endregion

    /**********FUNCTIONS AND REQUESTS ****************/

    function viewLikedPerizie() {
        pagination = 1;
        $(".numberPagination").text("Pagina: " + pagination);
        indexPerizie = 0;
        indexScoreContainer = 0;
        containerPerizie.empty();
        if (likedPerizie.length == 0) {
            let alert = $("<div>");
            alert.addClass("alert alert-danger");
            alert.text("Non hai ancora aggiunto nessuna perizia ai preferiti");
            containerPerizie.append(alert);
            return;
        }
        else {
            let perizie = [];
            for (let i = 0; i < likedPerizie.length; i++) {
                let perizia = perizieGlobal.find(x => x._id == likedPerizie[i]);
                perizie.push(perizia);
            }
            inserisciMarkers(perizie);
            visualizePerizie(perizie);
        }

    }

    function filterPerizie() {
        let modalFilter = $("#modalFilter");
        if (isAdmin) {
            //create options for select operator
            let selectOperator = $("#filterUser");
            selectOperator.empty();
            let option = $("<option>");
            option.attr("value", "all");
            option.text("Tutti gli operatori");
            selectOperator.append(option);
            for (let key in operators) {
                let option = $("<option>");
                option.attr("value", key);
                option.text(operators[key]);
                selectOperator.append(option);
            }
            $("#filterUserContainer").removeClass("d-none");
        }
        else $("#filterUserContainer").addClass("d-none");
        modalFilter.modal("show");
        let btnFilterPerizie = $("#btnFilterPerizie");
        btnFilterPerizie.on("click", function () {
            let opertorSelected = "";
            if (isAdmin) {
                opertorSelected = $("#filterUser").val();
            }
            else opertorSelected = operator;
            let filterPlace = $("#filterPlace").val();
            let filterDate = $("#filterDate").val();
            let filterScore = $("#filterScore").val();
            let completed = null;
            if ($("#radioCompleted").is(":checked")) completed = true;
            else if ($("#radioNotCompleted").is(":checked")) completed = false;
            let validated = null;
            if ($("#radioValidated").is(":checked")) validated = true;
            else if ($("#radioNotValidated").is(":checked")) validated = false;

            let parameters = {};
            if (opertorSelected != "all") parameters.codOperator = opertorSelected;
            if (filterDate != "") parameters.dateAdded = filterDate;
            if (filterScore != "" && (filterScore >= 1 || filterScore <= 5)) parameters.score = parseInt(filterScore);
            if (completed != null) parameters.completed = completed;
            if (validated != null) parameters.validated = validated;

            //get lat and long from address with a promise 
            let geocoder = new google.maps.Geocoder();
            geocoder.geocode({
                "address": filterPlace,
            }, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    let lat = results[0].geometry.location.lat();
                    let lng = results[0].geometry.location.lng();
                    parameters.latitude = lat;
                    parameters.longitude = lng;
                }
                else console.log("Geocode was not successful for the following reason: " + status);
                let request = inviaRichiesta("POST", "/api/filterPerizie", { parameters });
                request.fail(errore);
                request.done((data) => {
                    console.log(data);
                    perizieGlobal = data;
                    pagination = 1;
                    $(".numberPagination").text("Pagina: " + pagination);
                    indexPerizie = 0;
                    indexScoreContainer = 0;
                    containerPerizie.empty();
                    if (data.length == 0) {
                        //show message alert of bootstrap
                        let alert = $("<div>");
                        alert.addClass("alert alert-warning alert-dismissible fade show");
                        alert.attr("role", "alert");
                        alert.text("Nessuna perizia trovata");
                        let button = $("<button>");
                        button.addClass("btn-close");
                        button.attr("type", "button");
                        button.attr("data-bs-dismiss", "alert");
                        button.attr("aria-label", "Close");
                        alert.append(button);
                        containerPerizie.append(alert);
                        $(".results").text(data.length + " risultati");
                        modalFilter.modal("hide");
                    }
                    else {
                        //cambiare il numero di risultati trovati
                        $(".results").text(data.length + " risultati");
                        //visualizzo le perizie
                        visualizePerizie(data);
                        //disegno i marker sulla mappa
                        inserisciMarkers(data);
                        //chiudo il modal
                        modalFilter.modal("hide");
                    }
                    btnFilterPerizie.off("click");
                });
            });
        });

        let btnRemoveFilter = $("#btnRemoveFilter");
        btnRemoveFilter.on("click", function () {
            indexPerizie = 0;
            pagination = 1;
            $(".numberPagination").text("Pagina: " + pagination);
            indexScoreContainer = 0;
            containerPerizie.empty();
            if (isAdmin) getPerizie(null);
            else getPerizie(operator);
            modalFilter.modal("hide");
            btnRemoveFilter.off("click");
        });

    }

    function searchPerizie() {
        let search = $("#search-input").val();
        if (search == "") {
            if (isAdmin) getPerizie(null);
            else getPerizie(operator);
        }
        else {
            let codOperator = "";
            if (isAdmin) codOperator = null;
            else codOperator = operator;
            let request = inviaRichiesta("POST", "/api/searchPerizie", { search, codOperator });
            request.fail(errore);
            request.done((data) => {
                console.log(data);
                perizieGlobal = data;
                pagination = 1;
                $(".numberPagination").text("Pagina: " + pagination);
                indexPerizie = 0;
                indexScoreContainer = 0;
                containerPerizie.empty();
                if (data.length == 0) {
                    containerPerizie.append(
                        $("<div>")
                            .addClass("alert alert-danger")
                            .text("Nessuna perizia trovata")
                    );
                }
                else {
                    //visualizza le perizie
                    inserisciMarkers(data);
                    visualizePerizie(data);
                }
            });
        }
    }


    function setInformationDashboard() {
        let request = inviaRichiesta("GET", "/api/totDipendenti");
        request.fail(errore);
        request.done((data) => {
            $(".totDipendenti").text(data);
        });

        request = inviaRichiesta("GET", "/api/totPerizieSettimanali");
        request.fail(errore);
        request.done((data) => {
            $(".totPerizieSettimanali").text(data);
        });

        request = inviaRichiesta("GET", "/api/mediaValutazioniPerizie");
        request.fail(errore);
        request.done((data) => {
            console.log(data)
            $(".valutazioniPerizieTotali").text(data[0].media);
        });
    }

    function listDipendenti() {
        $("#deleteUtente").off("click");
        for (const key in operators) {
            $(".list-group").append(
                $("<button>")
                    .addClass("list-group-item list-group-item-action")
                    .attr("type", "button")
                    .attr("data-bs-toggle", "list")
                    .attr("role", "tab")
                    .attr("aria-controls", "home")
                    .text(operators[key])
                    .on("click", function () {
                        //set all input values in readonly
                        $(".valuesOperator").each(function () {
                            $(this).prop("readonly", true);
                            $(this).removeClass("form-control")
                            $(this).addClass("form-control-plaintext");
                        });
                        //delete button
                        $(".buttonContainer button").remove();
                        $("#editValues").off("click");
                        $("#deleteValues").off("click");
                        getInformationDipendente(key);
                        //delete old chart
                        $("#chartPerizie").remove();
                        $(".chartContainer").append($("<canvas>").attr("id", "chartPerizie"));
                        getChart(key);
                    }
                    ));
        }
        //first element in list in active
        $(".list-group-item").first().addClass("active");
        //get information of first element
        $("#editValues").off("click");
        $("#deleteValues").off("click");
        getInformationDipendente(Object.keys(operators)[0]);
        getChart(Object.keys(operators)[0]);
    }

    let operatorSelected = "";
    function getInformationDipendente(operator) {
        $("#deleteUtente").off("click");
        let request = inviaRichiesta("POST", "/api/getInformationDipendente", { operator });
        request.fail(errore);
        request.done((data) => {
            console.log(data);
            for (const key in data) {
                $("#" + key).val(data[key]);
            }
            operatorSelected = operator;
        });

        $("#editValues").on("click", function () {
            //set all input values not in readonly
            $(".valuesOperator").each(function () {
                $(this).prop("readonly", false);
                $(this).removeClass("form-control-plaintext")
                $(this).addClass("form-control");
            });

            //create a button to save changes
            let btn = $("<button>");
            btn.attr("id", "saveChanges");
            btn.addClass("btn btn-primary");
            btn.text("Salva");
            btn.on("click", function () {
                let data = {};
                let error = false;
                $(".valuesOperator").each(function () {
                    data[$(this).attr("id")] = $(this).val();
                });
                if (data.codOperator == "" || data.nominativo == "" || data.email == "" || data.phone == "" || data.admin == "") error = true;
                //check if codOperator is valid and if it is not already in use in the vector operators except for the current operator
                let regex = /^[A-Z]{4}[0-9]{4}$/;
                if (!regex.test(data.codOperator) || (data.codOperator != operator && operators[data.codOperator] != undefined)) error = true;
                //check if email is valid
                regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
                if (!regex.test(data.email)) error = true;
                //check if tel is valid
                regex = /^[0-9]{10}$/;
                if (!regex.test(data.phone)) error = true;
                //check if admin is valid (true or false)
                if (data.admin != "true" && data.admin != "false") error = true;

                if (error) {
                    alert("Dati inseriti non validi");
                    return;
                }

                let request = inviaRichiesta("POST", "/api/editDipendente", { data });
                request.fail(errore);
                request.done((data) => {
                    console.log(data);
                    if (data.acknowledged) {
                        alert("Dati modificati");
                        //set all input values in readonly
                        $(".valuesOperator").each(function () {
                            $(this).prop("readonly", true);
                            $(this).removeClass("form-control")
                            $(this).addClass("form-control-plaintext");
                        });
                        //delete button
                        btn.remove();
                        //update operators vector
                        operators[data.codOperator] = data.nominativo;
                        //update list of operators
                        $(".list-group").empty();
                        listDipendenti();
                    }
                    else {
                        alert("Errore nella modifica dei dati");
                    }
                });
            });
            $(".buttonContainer").append(btn);

            //create a button annulla
            let btnAnnulla = $("<button>");
            btnAnnulla.attr("id", "annullaChanges");
            btnAnnulla.addClass("btn btn-primary");
            btnAnnulla.text("Annulla");
            btnAnnulla.css("margin-left", "20px");
            btnAnnulla.on("click", function () {
                //set all input values in readonly
                $(".valuesOperator").each(function () {
                    $(this).prop("readonly", true);
                    $(this).removeClass("form-control")
                    $(this).addClass("form-control-plaintext");
                });
                //delete button
                btn.remove();
                btnAnnulla.remove();
            });
            $(".buttonContainer").append(btnAnnulla);
        });

        //delete button
        $("#deleteUtente").on("click", function () { deleteUtente(operatorSelected) });
    }

    function deleteUtente(operator) {
        Swal.fire({
            title: 'Sei sicuro di voler eliminare l\'utente?',
            text: "Non potrai più recuperare i dati dell'utente",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Si, elimina!'
        }).then((result) => {
            if (result.isConfirmed) {
                let request = inviaRichiesta("POST", "/api/deleteDipendente", { operator });
                request.fail(errore);
                request.done((data) => {
                    console.log(data);
                    if (data.acknowledged) {
                        Swal.fire(
                            'Utente Eliminato!',
                            'L\'utente è stato eliminato con successo.',
                            'success'
                        )
                        //update operators vector
                        delete operators[operator];
                        //update list of operators
                        $(".list-group").empty();
                        listDipendenti();
                        setInformationDashboard();

                        //tolgo il click sul bottone
                        $("#deleteUtente").off("click");
                    }
                    else {
                        Swal.fire(
                            'Errore!',
                            'Errore nella cancellazione dell\'utente.',
                            'error'
                        )
                    }
                });
            }
            else {
                Swal.fire(
                    'Annullato!',
                    'L\'utente non è stato eliminato.',
                    'info'
                )
            }
        })
    }

    function getChart(operator) {
        $("#deleteUtente").off("click");
        let request = inviaRichiesta("POST", "/api/getChart", { operator });
        request.fail(errore);
        request.done((data) => {
            console.log(data.label);
            console.log("DATA CHART: ", data.data);
            let canvas = $("#chartPerizie")[0];
            let chart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: data.label,
                    datasets: [{
                        label: "Grafico perizie nel tempo con il relativo punteggio",
                        data: data.data,
                        fill: false,
                        backgroundColor: data.backgroundColor,
                        borderColor: "rgba(100, 100, 100, 0.8)",
                        tension: 0.1
                    }]
                }
            });
            $("#deleteUtente").on("click", function () { deleteUtente(operator) });
        });
    }


    function viewSectionAdmin() {
        $(".mapContainer").css("display", "none");
        $(".dashboardAdmin").removeClass("d-none");
        $(".periziaDetails").addClass("d-none");
    }

    function viewMap() {
        $(".mapContainer").css("display", "block");
        $(".dashboardAdmin").addClass("d-none");
        $(".periziaDetails").addClass("d-none");

        $("#annullaChanges").remove();
        $("#saveChanges").remove();

        containerPerizie.empty();
        indexPerizie = 0;
        pagination = 1;
        $(".numberPagination").text("Pagina: " + pagination);
        indexScoreContainer = 0;
        containerPerizie.empty();
        if(isAdmin)
            getPerizie(null, null);
        else
            getPerizie(operator, null);
        
        
    }

    function orderPerizie() {
        //check which buttons are checked
        let btnCheks = $(".btn-check");
        let btnCheksChecked = [];
        for (const btn of btnCheks) {
            if (btn.checked)
                btnCheksChecked.push($(btn).val());
        }
        console.log(btnCheksChecked);
        //order perizie
        indexPerizie = 0;
        pagination = 1;
        $(".numberPagination").text("Pagina: " + pagination);
        indexScoreContainer = 0;
        containerPerizie.empty();
        if (isAdmin) {
            getPerizie(null, btnCheksChecked);
        }
        else {
            getPerizie(operator, btnCheksChecked);
        }
    }

    function getOperator() {
        return new Promise((resolve, reject) => {
            let request = inviaRichiesta("GET", "/api/operators");
            request.fail(errore);
            request.done((data) => {
                for (const operator of data) {
                    operators[operator.codOperator] = operator.nominativo;
                }
                resolve();
            });

        });
    }

    function getPerizie(codOperator = null, ordering = null) {
        containerPerizie.empty();
        let request = inviaRichiesta("POST", "/api/perizie", { codOperator, ordering });
        request.fail(errore);
        request.done((data) => {
            perizieGlobal = data;
            $(".results").text(data.length + " risultati");
            btnPrevious.prop("disabled", true);
            if (data.length <= 2)
                btnNext.prop("disabled", true);

            //order perizie by location compared by position = new google.maps.LatLng(44.5557763, 7.7347183);
            if (ordering != null && ordering.includes("distance")) {
                let position = new google.maps.LatLng(44.5557763, 7.7347183);
                data.sort((a, b) => {
                    let latA = a.place.coordinates.latitude;
                    let lngA = a.place.coordinates.longitude;
                    let latB = b.place.coordinates.latitude;
                    let lngB = b.place.coordinates.longitude;
                    let distanceA = google.maps.geometry.spherical.computeDistanceBetween(position, new google.maps.LatLng(latA, lngA));
                    let distanceB = google.maps.geometry.spherical.computeDistanceBetween(position, new google.maps.LatLng(latB, lngB));
                    return distanceA - distanceB;
                });
            }
            inserisciMarkers(data);
            if (data.length > 0){
                pagination = 1;
                $(".numberPagination").text("Pagina: " + pagination);
                indexPerizie = 0;
                indexScoreContainer = 0;
                containerPerizie.empty();
                visualizePerizie(data);
            }
            else {
                $(".containerPerizie").append($("<div>").addClass("alert alert-danger").text("Nessuna perizia trovata"));
            }
        });
    }

    function visualizePerizie(data) {
        containerPerizie.empty();
        let perizie = [];
        if (indexPerizie <= perizieGlobal.length - 1)
            perizie.push(data[indexPerizie]);
        if (indexPerizie + 1 <= perizieGlobal.length - 1)
            perizie.push(data[indexPerizie + 1]);
        for (const perizia of perizie) {
            console.log(perizia);
            $("<div>").addClass("col").appendTo(containerPerizie)
                .append($("<div>").addClass("card mb-3")
                    .append($("<div>").addClass("row g-0")
                        .append($("<div>").addClass("col-md-4")
                            .append($("<img>").attr("src", perizia.photos[0].url).addClass("img-fluid rounded-start").attr("alt", "testImage").on("click", function () { visualizzaPerizia(perizia) })))
                        .append($("<div>").addClass("col-md-8")
                            .append($("<div>").addClass("card-body")
                                .append($("<div>").addClass("d-flex align-items-baseline justify-content-between")
                                    .append($("<h5>").addClass("card-title").text(perizia.title))
                                    .append($('<div>').addClass("containerOfSettings d-flex justify-content-end")
                                        .append($("<button>").addClass("btn")
                                            .append($("<iconify-icon>").addClass("likedPerizia").attr("id", perizia._id).attr("icon", "mdi:heart-outline").attr("width", "20").attr("height", "20")))
                                        .append($("<button>").addClass("btn")
                                            .append($("<iconify-icon>").attr("icon", "mdi:settings-outline").attr("width", "20").attr("height", "20")))))
                                .append($("<div>").addClass("containerOrders d-flex")
                                    .append($("<p>").text(perizia.place.name)))
                                .append($("<p>").addClass("card-text").text(perizia.description))
                                .append($("<div>").addClass("scoreAndAuthor d-flex justify-content-between")
                                    .append($("<p>").addClass("card-text scored"))
                                    .append($("<p>").addClass("card-text")
                                        .append($("<small>").addClass("text-muted").text("By " + operators[perizia.codOperator]))))))));

            for (let i = 0; i < perizia.score; i++) {
                $(".scored").eq(indexScoreContainer).append($("<iconify-icon>").attr("icon", "mdi:star").attr("width", "20").attr("height", "20"));
            }

            //coloro il cuore se la perizia è tra le preferite
            if (likedPerizie.includes(perizia._id)) {
                $(".likedPerizia").eq(indexScoreContainer).attr("icon", "mdi:heart");
                $(".likedPerizia").eq(indexScoreContainer).css("color", "red");
            }

            //gestione click sul cuore
            $(".likedPerizia").eq(indexScoreContainer).on("click", function () {
                let idPerizia = $(this).attr("id");
                if ($(this).attr("icon") == "mdi:heart-outline") {
                    let request = inviaRichiesta("POST", "/api/likedPerizia",
                        { "idPerizia": idPerizia, "codOperator": operator });
                    request.fail(errore);
                    request.done(function (data) {
                        console.log(data);
                        $("#" + idPerizia).attr("icon", "mdi:heart");
                        $("#" + idPerizia).css("color", "red");
                    });
                }
                else {
                    let request = inviaRichiesta("POST", "/api/dislikedPerizia",
                        { "idPerizia": idPerizia, "codOperator": operator });
                    request.fail(errore);
                    request.done(function (data) {
                        console.log(data);
                        $("#" + idPerizia).attr("icon", "mdi:heart-outline");
                        $("#" + idPerizia).css("color", "black");
                    });
                }

            });

            indexScoreContainer++;
        }

        //gestione pulsanti next e previous
        if (indexPerizie >= perizieGlobal.length - 2)
            btnNext.prop("disabled", true);
        else
            btnNext.prop("disabled", false);
        if (indexPerizie <= 0)
            btnPrevious.prop("disabled", true);
        else
            btnPrevious.prop("disabled", false);
    }

    function visualizzaPerizia(perizia) {
        $(".mapContainer").css("display", "none");
        $(".periziaDetails").removeClass("d-none");
        $(".carousel-inner").empty();
        for (let i = 0; i < perizia.photos.length; i++) {
            let photoDescription = perizia.photos[i].description;
            if (photoDescription == null) photoDescription = "";
            $(".carousel-inner").append($("<div>")
                .addClass("carousel-item")
                .attr("data-bs-interval", "5000")
                .append($("<img>").addClass("d-block w-100").attr("src", perizia.photos[i].url)
                    .attr("alt", perizia.photos[i].description))
                .append($("<div>").addClass("carousel-caption d-none d-md-block")
                    .append($("<h5>").text(perizia.title))
                    .append($("<p>").text(photoDescription))));
        }
        $(".carousel-inner").children().first().addClass("active");


        $(".titlePerizia").val(perizia.title);
        $(".descriptionPerizia").val(perizia.description);
        $(".placePerizia").val(perizia.place.name);
        $(".scorePerizia").empty();
        for (let i = 0; i < perizia.score; i++) {
            $(".scorePerizia").append($("<iconify-icon>").addClass("star").attr("icon", "mdi:star").attr("width", "20").attr("height", "20"));
        }
        //if score is below 5, add empty stars
        if (perizia.score < 5) {
            for (let i = 0; i < 5 - perizia.score; i++) {
                $(".scorePerizia").append($("<iconify-icon>").addClass("star").attr("icon", "mdi:star-outline").attr("width", "20").attr("height", "20"));
            }
        }

        $(".authorPerizia").val(operators[perizia.codOperator]);
        $(".datePerizia").val(perizia.dateAdded);
        $(".completedPerizia").prop("checked", perizia.completed);
        $(".validatedPerizia").prop("checked", perizia.validated);

        if (isAdmin) {
            $(".containerCommentPerizia").removeClass("d-none");
            $("#commentoPerizia").val(perizia.comment);
        }

        //show map with marker
        //si potrebbe usare il setInterval per usare il getPosition() tipo ogni 10secondi
        let gpsOptions = {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0 // tempo max di presenza in cache della risposta (ms) //cioè mi restituisce l'ultimo valore senza aggiornarlo
        }
        //navigator.geolocation.getCurrentPosition(visualizzaPosizione, errore, gpsOptions)
        let watchId = navigator.geolocation.watchPosition(visualizzaPosizione, errore, gpsOptions); //lancia una lettura continuativa
        //navigator.geolocation.clearWatch(watchId); //per fermare la lettura continuativa

        function visualizzaPosizione(posizione) {
            let lat = posizione.coords.latitude;
            let lon = posizione.coords.longitude;
            let currentPos = new google.maps.LatLng(lat, lon);
            let positionPerizia = new google.maps.LatLng(perizia.place.coordinates.latitude, perizia.place.coordinates.longitude);

            //calcolare il percorso tra la mia posizione e la posizione della perizia
            let directionsService = new google.maps.DirectionsService();
            let routesOptions = {
                origin: currentPos,
                destination: positionPerizia,
                travelMode: google.maps.TravelMode.DRIVING
            }
            let rendererOptions = {
                polylineOptions: {
                    strokeColor: "red",
                    strokeWeight: 6,
                    zIndex: 100 //per farlo stare sopra al marker
                }
            }
            let directionsRenderer = new google.maps.DirectionsRenderer(rendererOptions);
            let promise = directionsService.route(routesOptions)
            promise.then(function (directionsRoutes) {
                let mapOptions = {};
                let mappa = new google.maps.Map(mapPerizia, mapOptions); //lo zoom lo calcola da solo
                if (directionsRoutes.status == google.maps.DirectionsStatus.OK) {
                    console.log(directionsRoutes.routes[0]);
                    //se è andato tutto bene andiamo a visualizzare la mappa
                    directionsRenderer.setMap(mappa) //gli passiamo la mappa
                    directionsRenderer.setRouteIndex(0) //vogliamo visualizzare la prima
                    directionsRenderer.setDirections(directionsRoutes)
                    panel.innerHTML = ""
                    directionsRenderer.setPanel(panel) // pannello con le indicazioni stradali

                    //calcolo della distanza
                    let distanza = directionsRoutes.routes[0].legs[0].distance.text;
                    let durata = directionsRoutes.routes[0].legs[0].duration.text;
                    console.log("DISTANZA: <strong>" + distanza + "</strong>" +
                        "\n DURATA: <strong>" + durata + "</strong>");
                }
            });
            promise.catch(function () {
                console.log("Errore nella promise");
            });
        }

        let btnEditValuesPerizia = $("#editValuesPerizia");
        btnEditValuesPerizia.on("click", function () {
            //remove readonly in all inputs except for the score and author
            $(".titlePerizia").prop("readonly", false);
            $(".descriptionPerizia").prop("readonly", false);
            $(".placePerizia").prop("readonly", false);
            $(".datePerizia").prop("readonly", false);
            $(".completedPerizia").prop("disabled", false);
            if (isAdmin) $(".validatedPerizia").prop("disabled", false);
            if (isAdmin) $(".commentoPerizia").prop("readonly", false);


            //remove class form-control-plaintext
            $(".titlePerizia").removeClass("form-control-plaintext");
            $(".descriptionPerizia").removeClass("form-control-plaintext");
            $(".placePerizia").removeClass("form-control-plaintext");
            $(".datePerizia").removeClass("form-control-plaintext");
            $(".completedPerizia").removeClass("form-control-plaintext");
            if (isAdmin) $(".validatedPerizia").removeClass("form-control-plaintext");
            if (isAdmin) $(".commentoPerizia").removeClass("form-control-plaintext");

            //when i click to a star, it changes in outline if it was filled, and viceversa
            if (isAdmin) {
                $(".star").on("click", function () {
                    if ($(this).prop("icon") == "mdi:star") $(this).prop("icon", "mdi-star-outline");
                    else $(this).prop("icon", "mdi:star");
                });
            }

            //create a button to save the changes
            let btnSaveChanges = $("<button>").addClass("btn btn-success").text("Salva modifiche");
            $(".containerSaveEditPerizia").append(btnSaveChanges);

            //create a button to cancel the changes
            let btnCancelChanges = $("<button>").addClass("btn btn-danger").text("Annulla modifiche");
            btnCancelChanges.css("margin-left", "20px")
            $(".containerSaveEditPerizia").append(btnCancelChanges);


            btnSaveChanges.on("click", function () {
                //take all the values from the inputs
                let title = $(".titlePerizia").val();
                let description = $(".descriptionPerizia").val();
                let place = $(".placePerizia").val();
                let date = $(".datePerizia").val();
                let completed = $(".completedPerizia").prop("checked");
                let validated = $(".validatedPerizia").prop("checked");
                let comment = $(".commentoPerizia").val();

                //calculate the score
                let score = 0;
                $(".star").each(function () {
                    if ($(this).prop("icon") == "mdi:star") score++;
                });


                let parameters = {
                    "place": {
                        "name": "",
                        "coordinates": {}
                    },
                    "title": "",
                    "description": "",
                    "dateAdded": "",
                    "completed": false,
                    "validated": false,
                    "score": 0,
                    "comment": "Nessuna osservazione"
                };
                let error = false;
                if (title != perizia.title && title != "") parameters.title = title;
                else if (title == "") error = true;
                else delete parameters.title;
                if (description != perizia.description && description != "") parameters.description = description;
                else if (description == "") error = true;
                else delete parameters.description;
                if (place != perizia.place.name && place != "") {
                    parameters["place"].name = place;
                    parameters["place"]["coordinates"].latitude = perizia.place.coordinates.latitude;
                    parameters["place"]["coordinates"].longitude = perizia.place.coordinates.longitude;
                }
                else if (place == "") error = true;
                else delete parameters.place;
                if (date != perizia.dateAdded && date != "") parameters.dateAdded = date;
                else if (date == "") error = true;
                else delete parameters.dateAdded;
                if (completed != perizia.completed) parameters.completed = completed;
                else delete parameters.completed;
                if (validated != perizia.validated) parameters.validated = validated;
                else delete parameters.validated;
                if (score != perizia.score && score != 0) parameters.score = score;
                else if (score == 0) error = true;
                else delete parameters.score;
                if (comment != perizia.comment && comment != "") parameters.comment = comment;
                else if (comment == "") error = true;
                if (error) {
                    alert("Non puoi lasciare campi vuoti");
                    return;
                }
                //send the request to the server
                let request = inviaRichiesta("PATCH", "/api/editPerizia", { parameters, id: perizia._id });
                request.fail(errore);
                request.done(function (data) {
                    console.log(data);
                    alert("Modifiche salvate");
                    location.reload();
                });
            });

            btnCancelChanges.on("click", function () {
                location.reload();
            });
        });

        $("#btnBack").on("click", function () {
            $(".periziaDetails").addClass("d-none");
            $(".mapContainer").css("display", "block");
            $(".perizieContainer").css("display", "block");
        });
    }

    function nextPagePerizie() {
        pagination++;
        indexPerizie += 2;
        containerPerizie.empty();
        indexScoreContainer = 0;
        $(".numberPagination").text("Pagina: " + pagination);
        visualizePerizie(perizieGlobal);
    }

    function previousPagePerizie() {
        pagination--;
        indexPerizie -= 2;
        containerPerizie.empty();
        indexScoreContainer = 0;
        $(".numberPagination").text("Pagina: " + pagination);
        visualizePerizie(perizieGlobal);
    }

    function changeColor() {
        navitems.children("a").removeClass("active");
        dropdown.children("a").removeClass("active");
        $(this).children("a").addClass("active");
    }

    function logout() {
        localStorage.removeItem("token")
        window.location.href = "login.html"
    }


    //MAPPA
    function inserisciMarkers(data, container = wrapper) {
        let position = new google.maps.LatLng(44.5557763, 7.7347183); //posizione di partenza (Vallauri)
        let map = new google.maps.Map(container, mapsOption);
        for (const item of data) {
            let positionMarker = new google.maps.LatLng(item.place.coordinates.latitude, item.place.coordinates.longitude);
            let marker = new google.maps.Marker({
                position: positionMarker,
                map: map,
                title: item.title
            });

            let infoWindow = new google.maps.InfoWindow({
                content: item.title,
                maxWidth: 200
            });

            marker.addListener("click", function () {
                infoWindow.open(map, marker);
            });
        }
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

            disableDefaultUI: true,   //cosa che posso aggiungere in seguito manualmente

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
        script.src = URL + '/js?&key=' + MAP_KEY + "&libraries=geometry&callback=";
        document.body.appendChild(script);
        script.onload = resolve; //evento che si verifica quando si carica lo script
        script.onerror = reject;
    })
    return promise;
}