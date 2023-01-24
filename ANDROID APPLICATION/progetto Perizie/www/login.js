"use strict";


//document ready of cordova
document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  let boolClicked = false;

  //riferimenti della login page
  let email = $("#txtEmail");
  let pwd = $("#txtPassword");

  $("#btnLogin").on("click", controllaLogin);

  //se premo invio eseguo la funzione controllaLogin
  $(document).on("keydown", function (event) {
    if (event.keyCode == 13) controllaLogin();
  });

  //se su mobile allora uso la funzione lampeggia
  if ($(window).width() < 768)
    lampeggia();

  let modalForgotPassword = $("#modalForgotPassword");
  let btnForgotPassword = $("#btnForgotPassword");
  btnForgotPassword.on("click", function () {
    modalForgotPassword.modal("show");
  });
  let btnSendEmail = $("#btnSendEmail");
  btnSendEmail.on("click", function () {
    let email = $("#txtEmailForgotPassword").val();
    let request = inviaRichiesta("POST", "/api/forgotPassword", {
      email: email
    });
    request.fail(function (jqXHR, test_status, str_error) {
      if (jqXHR.status == 401) {
        alert("Non sei autorizzato ad accedere, contatta l'amministratore");
      } else errore(jqXHR, test_status, str_error);
    });
    request.done(function (data, test_status, jqXHR) {
      console.log(data);
      if (data.ris == "ok")
        modalForgotPassword.modal("hide");
      else alert("Email non trovata");
    });
  });

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

  function controllaLogin() {
    email.removeClass("my-is-invalid is-invalid");
    email.prev().removeClass("icona-rossa");
    pwd.removeClass("my-is-invalid is-invalid");
    pwd.prev().removeClass("icona-rossa");

    let err = false;
    if (email.val() == "") {
      email.addClass("my-is-invalid is-invalid");
      email.prev().addClass("icona-rossa");
      err = true;
    }
    if (pwd.val() == "") {
      pwd.addClass("my-is-invalid is-invalid");
      pwd.prev().addClass("icona-rossa");
      err = true;
    }
    if (!err) {
      let request = inviaRichiesta("POST", "/api/login", {
        email: email.val(),
        password: pwd.val(),
        remember30days: $("#chkRememberLogged").prop("checked"),
      });
      request.fail(function (jqXHR, test_status, str_error) {
        if (jqXHR.status == 401) {
          // unauthorized
          Swal.fire({
            title: "Errore",
            text: "Credenziali errate",
            icon: "error",
            confirmButtonText: "Ok"
          });
        } else errore(jqXHR, test_status, str_error);
      });
      request.done(function (data, test_status, jqXHR) {
        console.log(jqXHR.getResponseHeader('Authorization')) //prendiamo il token			
        window.location.href = "index.html"
      });
    }
    else alert("Compila tutti i campi");
  }

}

function gplusLogin() {
  //login con google
  /*global google*/
  window.plugins.googleplus.login(
    {
      'webClientId': '426153637541-f66k37cc793jejdbg1llisk75kbfckt2.apps.googleusercontent.com',
      'offline': true
    },
    function (obj) {
      let request = inviaRichiesta("POST", "/api/googleLogin", {
        token: obj.idToken
      });
      request.fail(function (jqXHR, test_status, str_error) {
        if (jqXHR.status == 401) {
          alert("Non sei autorizzato ad accedere, contatta l'amministratore");
        } else errore(jqXHR, test_status, str_error);
      });
      request.done(function (data, test_status, jqXHR) {
        console.log(jqXHR.getResponseHeader('Authorization')) //prendiamo il token			
        window.location.href = "index.html"
      });
    }
  );
}