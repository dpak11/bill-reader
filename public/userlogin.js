const loginBtn = document.getElementById("login");
const registerBtn = document.getElementById("register");
const submitBtn = document.getElementById("submit");
const password = document.getElementById("pswd");
const email = document.getElementById("email");
const confirm = document.getElementById("confirm");
const activation = document.getElementById("act_code");
const statusBox = document.getElementById("statusbox");
let buttonsActive = true;
let user_mode = "";

registerBtn.addEventListener("click", function() {
    if (buttonsActive) {
        buttonsActive = false;
        fetch("../emailreq/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value, mode: "register" }) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "activation_code") {
                    showStatus("Sent Activation Code to your email. Please check your inbox or spam folder.");
                    user_mode = "register";
                    password.classList.remove("hidden");
                    confirm.classList.remove("hidden");
                    activation.classList.remove("hidden");
                    submitBtn.classList.remove("hidden");
                    email.classList.add("hidden");
                    registerBtn.classList.add("hidden");
                    loginBtn.classList.add("hidden");
                    sessionStorage.setItem("em", btoa(res.e_mail));
                }
                if (res.status == "email_send_fail") {
                    showStatus("Oops! Unable to send activation code to your email.");
                }
                if (res.status == "email_exists") {
                    showStatus("This Email is already registered");
                }
                if (res.status == "invalid") {
                    showStatus("Invalid Email Address");
                }
            });
    }

});

loginBtn.addEventListener("click", function() {
    if (buttonsActive) {
        buttonsActive = false;
        fetch("../emailreq/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value, mode: "login" }) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "email_none") {
                    showStatus("Email Address not registered.");
                }
                if (res.status == "invalid") {
                    showStatus("Invalid Email Address");
                }
                if (res.status == "require_pswd") {
                    user_mode = "login";
                    password.classList.remove("hidden");
                    submitBtn.classList.remove("hidden");
                    email.classList.add("hidden");
                    registerBtn.classList.add("hidden");
                    loginBtn.classList.add("hidden");
                    sessionStorage.setItem("em", btoa(res.e_mail));
                    buttonsActive = true;
                }
            });
    }

});

submitBtn.addEventListener("click", function() {
    if (buttonsActive) {
        buttonsActive = false;
        if (user_mode == "login") {
            fetch("../login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")) }) })
                .then(data => data.json())
                .then(function(res) {
                    if (res.status == "email_ok") {
                        verifyPswdKeyDB(res.serv_em_key);
                    }
                    if (res.status == "email_invalid") {
                        showStatus("Unable to LogIn");
                    }
                });
        } else if (password.value === confirm.value) {
            fetch("../register/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")), a_code: activation.value }) })
                .then(data => data.json())
                .then(function(res) {
                    if (res.status == "activation_verified") {
                        saveKeyToDB(res.serv_em_key);

                    }
                    if (res.status == "code_invalid") {
                        showStatus("Invalid Activation Code");
                    }
                });
        } else {
            showStatus("Passwords do not Match.");
        }
    }


});

function saveKeyToDB(em_key) {
    let _key = generatePasswordKey(password.value, em_key);
    fetch("../storekey/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), serv_copy: _key.serv }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "registered") {
                sessionStorage.setItem("ckey", _key.cli);
                sessionStorage.setItem("skey", _key.serv);
                location.replace("/home")
            }
        })

}

function verifyPswdKeyDB(em_key) {
    let _key = generatePasswordKey(password.value, em_key);
    fetch("../checkloginkey/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), serv_copy: _key.serv }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "verified") {
                sessionStorage.setItem("ckey", _key.cli);
                sessionStorage.setItem("skey", _key.serv);
                location.replace("/home")
            }
            if (res.status == "invalid") {
                showStatus("Invalid credentials");
            }
        })

}

function showStatus(msg) {
    statusBox.innerText = msg;
    statusBox.classList.remove("hidden");
    setTimeout(function() {
        statusBox.classList.add("hidden");
        buttonsActive = true;
    }, 5000)
}

user_validate().then(function(status){
    if(status == "valid"){
        location.replace("/home")
    }
}).catch(function(s){
    if(s == "Server_error"){
        showStatus("Server Busy");
    }
    console.log(s)
})

