/*jshint esversion: 6*/

const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Tesseract = require("tesseract.js");
const { TesseractWorker } = Tesseract;


const http = require('http').Server(app);
const port = process.env.PORT || 3000;
const KEYS_DATA = require("./keys");

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({ limit: '2mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let mongoURL = KEYS_DATA.mongodb;
let ReceiptUsers = mongoose.model("ReceiptUsers", new mongoose.Schema({
    userid: String,
    username: String,
    usertype: String,
    userpass: String,
    email: String
}));
/*mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }, function() {
    console.log("MongoDB connected");

    ReceiptUsers.create({
        userid: "saddad321",
        username: "gopi",
        usertype: "admin",
        userpass: "password",
        email: "gopi@yahoo.com"
    }, function(err,data) {
        if(err){
            console.log(err)
        }else{
            console.log("Added collection");
            console.log(data)
        }
    })
}).catch(function(err) {
    console.log("MongoDB error");
    console.log(err)
});*/


let dummyDB = [];



let transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    auth: {
        user: KEYS_DATA.email,
        pass: KEYS_DATA.mailerPswd
    }
});


function sendActivationMail(toEmail, code, resp) {

    let mailOptions = {
        from: KEYS_DATA.email,
        to: toEmail,
        subject: "Your Activation Code",
        html: `<h3>Hello!</h3>
        <p>Thank You for your interest in trying out Bill Reader</p>
        <p>Your activation code is: <b>${code}</b></p> `
    }

    transporter.sendMail(mailOptions, function(err, data) {

        if (err) {
            console.log("Node Mailer Error: \n" + err);
            // resp.json({ status: "email_send_fail" });
            console.log("Activation:" + code);
            resp.json({ status: "activation_code", e_mail: toEmail });

        } else {
            console.log("Email delivered");
            resp.json({ status: "activation_code", e_mail: toEmail });

        }
    });
}




function isValidEmail(em) {
    let validchars = "0123456789qwertyuioplkjhgfdsazxcvbnm_.@";
    let indexes = [];
    indexes.push(em.indexOf("@"));
    indexes.push(em.lastIndexOf("."));
    indexes.push(em.lastIndexOf("@"));
    if (em.length < 10 || indexes[0] <= 2 || indexes[0] !== indexes[2] || indexes[1] < indexes[2]) {
        return false;
    }
    for (let i = 0; i < em.length; i++) {
        if (validchars.indexOf(em.substr(i, 1)) == -1) {
            return false;
        }
    }

    return true;
}


function generateEmailConstantKey(email) {
    let constantkey = "2UoH8OIQlxWJzAVcu9T6smLNXpFqZSR1tyD+g4bnwCfhkd=GKv7BMeaYirEjP503";
    let encodedEmail = Buffer.from(email).toString('base64');
    console.log(encodedEmail);
    const len = encodedEmail.length;
    const max = constantkey.length - 1;
    let str = ``;
    for (let i = 0; i < len; i++) {
        let index = constantkey.indexOf(encodedEmail.substr(i, 1)) + email.length;
        index = index >= max ? index - max : index;
        str = `${str}${constantkey.substr(index,1)}`;
    }
    console.log(str);
    return Buffer.from(str).toString('base64')
}


function scanBill(img) {
    const worker = new TesseractWorker();
    return worker.recognize(img)
        .progress((p) => {
            //console.log('progress', p);
        })
        .then(({ text }) => {
            console.log(text);
            let receiptTitle = sanitiser(text.split("\n")[0], false);
            let arr = text.toLowerCase().split("\n");
            let dateStr = dateSearch(arr);
            arr = arr.filter(function(txt) {
                return (txt.includes("total") || txt.includes("amount") || txt.includes("amnt") || txt.includes("payable"));
            });


            worker.terminate();
            return new Promise((resolve, reject) => {
                if (arr.length > 0) {
                    let get_total = sanitiser(extractTotalVal(arr), true);
                    resolve({ title: receiptTitle, total: get_total, date: dateStr });
                } else {
                    reject("No Total Found")
                }

            });

        });

}

function dateSearch(lines) {
    let pattern1 = new RegExp("([0-9]){1,2}/([0-9]){1,2}/([0-9]){2,4}");
    let pattern2 = new RegExp("([0-9]){1,2}-([0-9]){1,2}-([0-9]){2,4}");
    let dates = [];
    //console.log("date>>>>"+lines.length);
    let monthCheck = {
        vals: function(v) {
            if (v[2].length == 2 || v[2].length == 4) {
                if (Number(v[1]) > 12) {
                    let formattedMonth = `${v[1]}/${v[0]}/${v[2]}`;
                    return formattedMonth;
                } else {
                    return v.join("/");
                }
            }
            return false;
        }
    };

    lines.forEach(function(line) {

        let l1 = line.match(pattern1);
        let l2 = line.match(pattern2);
        if (l1 != null && l1.length > 1) {
            let m1 = monthCheck.vals(l1[0].split("/"));
            if (m1) { dates.push(m1) }
        }
        if (l2 != null && l2.length > 1) {
            let m2 = monthCheck.vals(l2[0].split("/"));
            if (m2) { dates.push(m2) }
        }
    })
    return dates[0]
}

function extractTotalVal(totals) {
    let totalValue = "";
    let subs = "";
    totals.forEach(function(_total) {
        if (totalValue == "") {
            let total = _total.trim();
            subs = total.indexOf("subtotal") >= 0 ? total.split("subtotal")[1] :
                total.indexOf("sub total") >= 0 ? total.split("sub total")[1] : "";
            totalValue = total.indexOf("amount payable") >= 0 ? total.split("amount payable")[1] :
                total.indexOf("payable amount") == 0 ? total.split("payable amount")[1] :
                total.indexOf("total amount") >= 0 ? total.split("total amount")[1] :
                total.indexOf("payable") >= 0 ? total.split("payable")[1] :
                total.indexOf("amount") >= 0 ? total.split("amount")[1] :
                total.indexOf("amnt") >= 0 ? total.split("amnt")[1] :
                (subs == "" && total.indexOf("total") >= 0) ? total.split("total")[1] : "";
        }
    });
    if (totalValue == "") {
        return subs;
    }
    return totalValue;
}

function sanitiser(str, isNumber) {
    let chars = isNumber ? "0123456789." : "0123456789qwertyuioplkjhgfdsazxcvbnm &QWERTYUIOPLKJHGFDSAZXCVBNM-";
    let newchar = "";
    console.log("################# \n" + str);
    for (let i = 0; i < str.length; i++) {
        let txt = str.substr(i, 1);
        if (chars.indexOf(txt) >= 0) {
            newchar = newchar + txt;
        }
    }
    return newchar;
}


function email_db_check(em, usermode) {
    let exists = false;
    dummyDB.forEach(function(val) {
        if (val.email == em) {
            exists = true;
        }
    });
    if (usermode == "register") {
        return !exists;
    }

    return exists;
}

function genActivationCode(em, apiresponse) {
    let actvCode = ``;
    for (let i = 0; i < 5; i++) {
        actvCode = `${actvCode}${Math.floor(Math.random()*10)}`;
    }

    dummyDB.push({ email: em, activation: actvCode, key: "", browser: "" });
    sendActivationMail(em, actvCode, apiresponse);
}

function activation_code_verify(em, code) {
    let valid = false;
    dummyDB.forEach(function(val) {
        if (val.email == em && val.activation == code) {
            valid = true;
        }
    });
    return valid;
}

function saveRegisterationDB(key, agent, email) {
    dummyDB.forEach(function(val) {
        if (val.email == email) {
            val.browser = agent;
            val.key = key;
        }
    });
}

function userAuthenticate(pskey, agent, email, mode) {
    let valid = false;
    dummyDB.forEach(function(val) {
        if (mode == "manual") {
            if (val.email == email && val.key == pskey) {
                val.browser = agent;
                valid = true;
            }
        } else if (val.email == email && val.key == pskey && val.browser == agent) {
            valid = true;
        }

    });
    return valid;
}



//console.log(Buffer.from("lop@yahoo.com").toString('base64'));
//console.log(Buffer.from("am9zZXBoQHlhaG9vLmNvbQ==","base64").toString('ascii'));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");

});
app.get("/home", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");

});

app.post("/emailreq", (req, res) => {
    let email = req.body.email.toLowerCase();
    let mode = req.body.mode;

    if (isValidEmail(email)) {
        if (email_db_check(email, mode)) {
            if (mode == "register") {
                genActivationCode(email, res);
            } else {
                res.json({ status: "require_pswd", e_mail: email })
            }

        } else {
            if (mode == "register") {
                res.json({ status: "email_exists" })
            } else {
                res.json({ status: "email_none" })
            }
        }

    } else {
        res.json({ status: "invalid" })
    }

});


app.post("/register", (req, res) => {
    let email = req.body.email;
    let code = req.body.a_code;
    if (activation_code_verify(email, code)) {
        let key = generateEmailConstantKey(email);
        res.json({ status: "activation_verified", serv_em_key: key })
    } else {
        res.json({ status: "code_invalid" })
    }
});
app.post("/login", (req, res) => {
    let email = req.body.email;
    if (email_db_check(email, "login")) {
        let key = generateEmailConstantKey(email);
        res.json({ status: "email_ok", serv_em_key: key })
    } else {
        res.json({ status: "email_invalid" })
    }
});

app.post("/storekey", (req, res) => {
    let pwdkey = req.body.serv_copy;
    let useragent = req.body.agent;
    let email = req.body.email;
    saveRegisterationDB(pwdkey, useragent, email);
    res.json({ status: "registered" });

});

app.post("/checkloginkey", (req, res) => {
    let pwdkey = req.body.serv_copy;
    let useragent = req.body.agent;
    let email = req.body.email;
    if (userAuthenticate(pwdkey, useragent, email, "manual")) {
        res.json({ status: "verified" });
    } else {
        res.json({ status: "invalid" });
    }

});

app.post("/userAuth", (req, res) => {
    let pwdkey = req.body.key_serv;
    let useragent = req.body.agent;
    let email = req.body.em;
    if (userAuthenticate(pwdkey, useragent, email, "auto")) {
        res.json({ status: "verified" });
    } else {
        res.json({ status: "invalid" });
    }

});



app.post("/processimage", (req, res) => {
    console.log("Image processing...");
    scanBill(req.body.img).then(function(data) {
        console.log(data);
        res.json({ status: data });
    }).catch(function(err) {
        res.json({ status: err });
    });

});



http.listen(port, () => {
    console.log(`Server running at port ` + port);
});