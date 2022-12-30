"use strict"


$(document).ready(function () {
    let boolClicked = false;
    let err = false;

    //riferimenti della registration page
    let nominativo = $("#txtNominativo");
    let email = $("#txtEmail");
    let pwd = $("#txtPassword");
    let tel = $("#txtTel");

    $("#btnRegistration").on("click", controllaRegistration);

    //se premo invio eseguo la funzione controllaRegistration
    $(document).on("keydown", function (event) {
        if (event.keyCode == 13) controllaRegistration();
    });

    //se su mobile allora uso la funzione lampeggia
    if ($(window).width() < 768)
        lampeggia();


    /*global google*/
    google.accounts.id.initialize({
        "client_id": "426153637541-f66k37cc793jejdbg1llisk75kbfckt2.apps.googleusercontent.com",
        "callback": function (response) {
            if (response.credential !== "") {
                let request = inviaRichiesta("POST", "/api/googleLogin", {
                    token: response.credential
                });
                request.fail(errore);
                request.done(function (data, test_status, jqXHR) {
                    console.log(jqXHR.getResponseHeader('Authorization')) //prendiamo il token			
                    window.location.href = "index.html"
                });
            }
        }
    });

    google.accounts.id.renderButton(
        document.getElementById("googleDiv"),
        {
            "theme": "outline",
            "size": "large",
            "type": "standard",
            "text": "continue_with",
            "shape": "rectangular",
            "logo_alignment": "center"
        }
    );

    $("#googleDiv").find().addClass("google-btn")

    google.accounts.id.prompt();

    /*********************FUNCTIONS AND REQUEST ************/
    function lampeggia() { //funzione per il lampeggio della freccia che porta alla scelta delle option
        let opacity = {
            "opacity": "1"
        };
        $("#arrow").animate(opacity, 1600, function () { //utilizzo la tecnica della ricorsione, che va all'infinito
            $(this).animate({ "opacity": "0" }, 500, function () {
                if (!boolClicked) {
                    lampeggia();
                }
            });
        });
    }

    function invalidValue(input) {
        input.addClass("my-is-invalid is-invalid");
        input.prev().addClass("icona-rossa");
        err = true;
    }

    function controllaRegistration() {
        err = false;
        email.removeClass("my-is-invalid is-invalid");
        email.prev().removeClass("icona-rossa");
        pwd.removeClass("my-is-invalid is-invalid");
        pwd.prev().removeClass("icona-rossa");
        nominativo.removeClass("my-is-invalid is-invalid");
        nominativo.prev().removeClass("icona-rossa");
        tel.removeClass("my-is-invalid is-invalid");
        tel.prev().removeClass("icona-rossa");

        if (email.val() == "") invalidValue(email);
        if (pwd.val() == "") invalidValue(pwd);
        if (nominativo.val() == "") invalidValue(nominativo);
        if (tel.val() == "") invalidValue(tel);

        if (!err) {
            let request = inviaRichiesta("POST", "/api/registration", {
                nominativo: nominativo.val(),
                email: email.val(),
                password: pwd.val(),
                phone: tel.val(),
            });
            request.fail(function (jqXHR, test_status, str_error) {
                if (jqXHR.status == 401) {
                    // unauthorized
                    alert("Credenziali già utilizzate");
                } else errore(jqXHR, test_status, str_error);
            });
            request.done(function (data, test_status, jqXHR) {
                console.log(jqXHR.getResponseHeader('Authorization')) //prendiamo il token			
                window.location.href = "index.html"
            });
        }
        else alert("Compila tutti i campi");
    }
});
