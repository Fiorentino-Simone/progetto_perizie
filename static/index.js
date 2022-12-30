"use strict";

$(document).ready(function () {
    
    let btnLogout = $("#btnLogout");
    btnLogout.on("click", logout);

    getUsers();

    /**********FUNCTIONS AND REQUESTS ****************/
    function logout(){
        localStorage.removeItem("token")
        window.location.href = "login.html"
    }
    
    function getUsers(){
        let request = inviaRichiesta("GET", "/api/users");
        request.fail(errore);
        request.done((data) => {
            console.log(data);
        });
    }

});
