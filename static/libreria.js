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
		url: url, //default: currentPage
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



function errore(jqXHR, testStatus, strError) {
	if (jqXHR.status == 0)
		alert("Connection refused or Server timeout");
	else if (jqXHR.status == 200)
		alert("Formato dei dati non corretto : " + jqXHR.responseText);
	else if (jqXHR.status == 403) //accesso negato (token scaduto)
		window.location.href = "login.html"
	else
		alert("Server Error: " + jqXHR.status + " - " + jqXHR.responseText);
}