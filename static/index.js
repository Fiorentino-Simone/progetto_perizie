"use strict";

$(document).ready(function () {
  let boolClicked=false;

  //se su mobile allora uso la funzione lampeggia
  if ($(window).width() < 768)
    lampeggia();


  /************************FUNCTIONS AND REQUEST *****************************/
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
});
