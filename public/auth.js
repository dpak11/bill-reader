function user_validate() {
    let client = sessionStorage.getItem("ckey") || false;
    let serv = sessionStorage.getItem("skey") || false;
    let sessionemail = sessionStorage.getItem("em") || false;
    if (client && serv && sessionemail) {
        return fetch("../userAuth/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv }) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "invalid") {
                    sessionStorage.clear();
                    return new Promise(function(resolve, reject) {
                        reject("invalid");
                    });

                }
                if (res.status == "verified") {
                    return new Promise(function(resolve, reject) {
                        resolve("valid");
                    });

                }
            }).catch(function() {
                sessionStorage.clear();
                return new Promise(function(resolve, reject) {
                    reject("Server_error");
                });
            });
    } else {
        return new Promise(function(resolve, reject) {
            reject("new_user");
        });
    }

}