function user_validate() {
    let client = sessionStorage.getItem("ckey") || false;
    let serv = sessionStorage.getItem("skey") || false;
    let sessionemail = sessionStorage.getItem("em") || false;
    if (client && serv && sessionemail) {
        return fetch("../userAuth/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: sessionemail, agent: btoa(navigator.userAgent), key_serv: serv }) })
            .then(data => data.json())
            .then((res) => {
                if (res.status == "invalid") {
                    sessionStorage.clear();
                    return new Promise((resolve, reject) => {
                        reject("invalid");
                    });

                }
                if (res.status == "verified") {
                    return Promise.resolve("valid");

                }
            }).catch(() => {
                sessionStorage.clear();
                return new Promise((resolve, reject) => {
                    reject("Server_error");
                });
            });
    } else {
        sessionStorage.clear();
        return new Promise((resolve, reject) => {
            reject("new_user");
        });
    }

}