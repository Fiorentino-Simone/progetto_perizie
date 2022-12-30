"use strict";

$(document).ready(function () {
  let boolClicked=false;
  
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
    if(!err) {
      let request = inviaRichiesta("POST", "/api/login", {
        email: email.val(),
        password: pwd.val(),
        remember30days: $("#chkRememberLogged").prop("checked"),
      });
      request.fail(function (jqXHR, test_status, str_error) {
        if (jqXHR.status == 401) {
          // unauthorized
          alert("Credenziali errate");
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
