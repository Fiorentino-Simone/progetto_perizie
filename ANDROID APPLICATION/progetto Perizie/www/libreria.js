
const API_URL = "https://192.168.1.29:1338"; //localhost

function inviaRichiesta(method, url, parameters = {}) {
	let contentType;
	if (method.toUpperCase() == "GET") {
		contentType = "application/x-www-form-urlencoded; charset=UTF-8"
	}
	else {
		contentType = "application/json; charset=utf-8"
		parameters = JSON.stringify(parameters);
	}

	return $.ajax({
		url: API_URL + url, //default: currentPage
		type: method,
		data: parameters,
		contentType: contentType,
		dataType: "json",
		timeout: 5000,
		beforeSend: function (jqXHR) {
			if ("token" in localStorage) {
				let token = localStorage.getItem("token");
				console.log("SEND -- ", token)
				jqXHR.setRequestHeader("Authorization", token);
			}
		},
		success: function (data, textStatus, jqXHR) {
			let token = jqXHR.getResponseHeader('Authorization')
			console.log("RECEIVE -- ", token)
			localStorage.setItem("token", token)
		}
	});
}


function erroreSweetAlert(errorMessage){
    Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: errorMessage,
        footer: '<a href="#Contattami">Se riscontri problematiche, contattami !</a>'
    })
}


function errore(jqXHR, testStatus, strError) {
	if (jqXHR.status == 0)
		erroreSweetAlert("Connection refused or Server timeout");
	else if (jqXHR.status == 200)
		erroreSweetAlert("Formato dei dati non corretto : " + jqXHR.responseText);
	else if (jqXHR.status == 403) //accesso negato (token scaduto)
		window.location.href = "login.html"
	else
		erroreSweetAlert("Server Error: " + jqXHR.status + " - " + jqXHR.responseText);
}