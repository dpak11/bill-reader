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
        statusBox.innerText = "please wait a moment...";
        statusBox.classList.remove("hidden");
        loginBtn.classList.add("inactive");
        registerBtn.classList.add("inactive");
        fetch("../emailreq/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value, mode: "register" }) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "activation_code") {
                    showStatus("Sent Activation Code to your email. Please check your inbox or spam folder.",5000);
                    user_mode = "register";
                    buttonsActive = true;
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
                    showStatus("Oops! Unable to send activation code to your email. Please try again.",5000);
                }
                if (res.status == "email_exists") {
                    showStatus("This Email is already registered",3000);
                }
                if (res.status == "busy") {
                    showStatus("Server Busy",3000);
                }
                if (res.status == "invalid") {
                    showStatus("Invalid Email Address",3000);
                }
            });
    }

});

loginBtn.addEventListener("click", function() {
    if (buttonsActive) {
        buttonsActive = false;        
        loginBtn.classList.add("inactive");
        registerBtn.classList.add("inactive");
        statusBox.innerText = "checking...";
        statusBox.classList.remove("hidden");
        fetch("../emailreq/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value, mode: "login" }) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "email_none") {
                    showStatus("Email Address not registered.",3000);
                }
                if (res.status == "invalid") {
                    showStatus("Invalid Email Address",3000);
                }
                if (res.status == "busy") {
                    showStatus("Server Busy",3000);
                }
                if (res.status == "require_pswd") {
                    user_mode = "login";
                    password.classList.remove("hidden");
                    submitBtn.classList.remove("hidden");
                    email.classList.add("hidden");
                    registerBtn.classList.add("hidden");
                    loginBtn.classList.add("hidden");
                    statusBox.classList.add("hidden");
                    sessionStorage.setItem("em", btoa(res.e_mail));
                    buttonsActive = true;
                }
            });
    }

});

submitBtn.addEventListener("click", function() {
    if (buttonsActive) {
        buttonsActive = false;
        submitBtn.classList.add("inactive");  
        statusBox.innerText = "Signing in...";
        statusBox.classList.remove("hidden");      
        if (user_mode == "login") {
            fetch("../login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")) }) })
                .then(data => data.json())
                .then(function(res) {
                    if (res.status == "email_ok") {
                        verifyPswdKeyDB(res.serv_em_key);
                    }
                    if (res.status == "email_invalid") {
                        showStatus("Unable to LogIn",3000);                        
                    }
                });
        } else if (password.value === confirm.value) {
            if (passwordStrength(password.value)) {
                fetch("../register/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: atob(sessionStorage.getItem("em")), a_code: activation.value }) })
                    .then(data => data.json())
                    .then(function(res) {
                        if (res.status == "activation_verified") {
                            saveKeyToDB(res.serv_em_key);

                        }
                        if (res.status == "code_invalid") {
                            showStatus("Invalid Activation Code",3000);
                        }
                    });
            }else{
                console.log("Invalid Password");
            }

        } else {
            showStatus("Passwords do not Match.",3000);
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
            if (res.status == "server_error") {
                showStatus("Server Busy",3000);
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
                showStatus("Invalid credentials",3000);
            }
        })

}

function passwordStrength(pswd) {
    if (pswd.length < 10) {
        showStatus("Password must have atleast 10 characters.",5000);
        return false;
    }
    let re = new RegExp("[0-9]");
    if (!re.test(pswd)) {
        showStatus("Password must contain at least 1 number.",5000);
        return false;
    }
   
    re = new RegExp("[a-z]");
    if (!re.test(pswd)) {
        showStatus("Password must contain at least 1 lowercase letter.",5000);
        return false;
    }
   
    re = new RegExp("[A-Z]");
    if (!re.test(pswd)) {
        showStatus("Password must contain at least 1 uppercase letter.",5000);
        return false;
    }
    return true;
}

function showStatus(msg,duration) {
    statusBox.innerText = msg;
    statusBox.classList.remove("hidden");
    loginBtn.classList.add("inactive");
    registerBtn.classList.add("inactive");
    submitBtn.classList.add("inactive");
    setTimeout(function() {
        statusBox.classList.add("hidden");
        loginBtn.classList.remove("inactive");
        registerBtn.classList.remove("inactive");
        submitBtn.classList.remove("inactive");
        buttonsActive = true;
    }, duration);
}

user_validate().then(function(status) {
    if (status == "valid") {
        location.replace("/home")
    }
}).catch(function(s) {
    if (s == "Server_error") {
        showStatus("Server Busy",3000);
    }
    
})