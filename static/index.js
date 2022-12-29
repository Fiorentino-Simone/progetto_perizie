"use strict";

$(document).ready(function () {
  let divIntestazione = $("#divIntestazione");
  let divFilters = $(".card").eq(0);
  let divCollections = $("#divCollections");
  let table = $("#mainTable");
  let divDettagli = $("#divDettagli");
  let currentCollection = "";

  divFilters.hide();
  $("#lstHair").prop("selectedIndex", -1);

  let request = inviaRichiesta("GET", "/api/getCollections");
  request.fail(errore);
  request.done((collections) => {
    console.log(collections);

    for (const collection of collections) {
      let label = divCollections.children("label").eq(0).clone();
      label.children("span").text(collection.name);
      label
        .children("input")
        .val(collection.name)
        .on("click", function () {
          currentCollection = $(this).val();
          divIntestazione.find("strong").eq(0).text(currentCollection);
          getCollection();
        });
      label.appendTo(divCollections);
      divCollections.append("<br>");
    }
    divCollections.children("label").eq(0).remove();
  });

  $("#btnAdd").on("click", () => {
    divDettagli.empty();
    //<button type="button" class="btn btn-success" id="btnAdd">
    $("<textarea>")
      .prop("placeholder", '{"key":"value"}')
      .appendTo(divDettagli);
    addButton("post", "");
  });

  $("#btnFind").on("click", function () {
    // prendo i parametri
    let hair = $("#lstHair").val().toLowerCase();
    let param = {
      hair,
    };
    if (!$("#chkMale").prop("checked") && !$("#chkFemale").prop("checked")) {
      alert("Seleziona almeno un genere");
    } else if (
      ($("#chkMale").prop("checked") && !$("#chkFemale").prop("checked")) ||
      (!$("#chkMale").prop("checked") && $("#chkFemale").prop("checked"))
    ) {
      let gender = divFilters.find("input[type=checkbox]:checked").val();
      param["gender"] = gender;
    }
    let request = inviaRichiesta("GET", "/api/" + currentCollection, param);
    request.fail(errore);
    request.done((data) => {
      console.log(data);
      createTable(data);
    });
  });

  function addButton(method, id) {
    $("<button>")
      .appendTo(divDettagli)
      .addClass("btn btn-success")
      .text("Invia")
      .on("click", () => {
        let stream = divDettagli.children("textarea").val(); // .val() non .text()
        try {
          stream = JSON.parse(stream);
        } catch (error) {
          alert(
            "Formato inserito non valido, chiavi e valori devono usare apici doppi"
          );
          return;
        }

        let request = inviaRichiesta(
          method,
          "/api/" + currentCollection + "/" + id,
          {
            stream,
          }
        );
        request.fail(errore);
        request.done((data) => {
          console.log(data);
          alert("Operazione eseguita correttamente");
          getCollection();
        });
      });
  }

  function getCollection() {
    // let collection = divCollections.children('input:checked').val();
    let request = inviaRichiesta("GET", "/api/" + currentCollection);
    request.fail(errore);
    request.done((data) => {
      console.log(data);
      createTable(data);
      if (currentCollection == "unicorns") {
        divFilters.show();
      } else {
        divFilters.hide();
      }
    });
  }

  function createTable(data) {
    let tbody = table.children("tbody");
    tbody.empty();
    divIntestazione.find("strong").eq(1).text(data.length);
    for (const record of data) {
      let tr = $("<tr>").appendTo(tbody);
      $("<td>")
        .appendTo(tr)
        .text(record._id)
        .prop("_id", record._id)
        .prop("action", "get")
        .on("click", dettagli);
      $("<td>")
        .appendTo(tr)
        .text(record.val)
        .prop("_id", record._id)
        .prop("action", "get")
        .on("click", dettagli);
      let td = $("<td>").appendTo(tr);
      $("<div>")
        .appendTo(td)
        .prop("action", "patch")
        .prop("_id", record._id)
        .on("click", dettagli);
      $("<div>")
        .appendTo(td)
        .prop("action", "put")
        .prop("_id", record._id)
        .on("click", dettagli);
      $("<div>")
        .appendTo(td)
        .prop("_id", record._id)
        .on("click", eliminaRecord);
    }
  }

  function eliminaRecord() {
    let _id = $(this).prop("_id");
    if (confirm("Sicuro di voler eliminare il record?")) {
      let request = inviaRichiesta(
        "DELETE",
        "/api/" + currentCollection + "/" + _id
      );
      request.fail(errore);
      request.done((ris) => {
        console.log(ris);
        alert("Record eliminato correttamente");
        getCollection();
      });
    }
  }

  function dettagli() {
    let _id = $(this).prop("_id");
    let action = $(this).prop("action");

    let request = inviaRichiesta("GET", `/api/${currentCollection}/${_id}`);
    request.fail(errore);
    request.done((data) => {
      console.log(data);
      divDettagli.empty();
      if (action == "get") {
        let str = "";
        for (const key in data) {
          str += `<b>${key}</b>: ${JSON.stringify(data[key])} <br>`;
        }
        divDettagli.html(str);
      } else {
        delete data["_id"];
        let textarea = $("<textarea>")
          .appendTo(divDettagli)
          .val(JSON.stringify(data, null, 2));
        textarea.css("height", textarea.get(0).scrollHeight + "px");
        addButton(action, _id);
      }
    });
  }
});
