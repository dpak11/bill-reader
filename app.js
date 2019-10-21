/*jshint esversion: 6*/

const express = require("express");

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Tesseract = require("tesseract.js");
const { TesseractWorker } = Tesseract;
const app = express();

const http = require('http').Server(app);
const port = process.env.PORT || 3000;
const KEYS_DATA = require("./keys");

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({ limit: '5mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

mongoose.Promise = global.Promise;
const mongoURL = KEYS_DATA.mongodb;

const billSchema = new mongoose.Schema({
    encr_img: String,
    data: String
});

let Users = null;
let Teams = null;

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }, function() {
    console.log("MongoDB connected");
    Users = mongoose.model("Users", new mongoose.Schema({
        email: String,
        activation: String,
        key: String,
        browser: String,
        name: String,
        photo: String,
        default: String,
        created: String,
        lastlogin: String,
        personal: new mongoose.Schema({
            bills: [{ billid: String, encr_img: String, data: String, submitdate: String }]
        })
    }));

    Teams = mongoose.model("Teams", new mongoose.Schema({
        teamid: String,
        logo: String,
        title: String,
        user_email: String,
        role: String,
        default: String,
        created: String,
        lastlogin: String,
        approver: String,
        logs: [],
        bills: [{ billid: String, encr_img: String, data: String, submitdate: String, status: String, logs: [] }]

    }));
}).catch(function(err) {
    console.log("MongoDB error");
    console.log(err)
});





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
        <p>Thank You for your interest in trying out Bill Vault</p>
        <p>Your activation code is: <b>${code}</b></p> `
    }

    transporter.sendMail(mailOptions, function(err, data) {

        if (err) {
            resp.json({ status: "email_send_fail" });
        } else {
            console.log("Email delivered");
            resp.json({ status: "activation_code", e_mail: toEmail });

        }
    });
}

function addUserToDB(e_mail, actCode) {
    const users = new Users({
        email: e_mail,
        activation: actCode,
        key: "",
        browser: "",
        name: "",
        photo: "",
        default: "personal",
        created: getIndDate(),
        lastlogin: "",
        personal: new mongoose.Schema({
            bills: [{ billid: String, encr_img: String, data: String, submitdate: String }]
        })
    });
    return users.save().then(function(data) {
        return new Promise((resolve, rej) => resolve());

    }).catch(function() {
        return new Promise((res, rej) => rej());
    })
}

function addToTeam(email, team) {
    console.log("addToTeam:" + email);
    const teams = new Teams({
        teamid: team,
        logo: "",
        title: "",
        user_email: email,
        role: "member",
        bills: [{ encr_img: "", data: "" }]
    });
    return teams.save().then(function(data) {
        return new Promise((resolve, rej) => resolve());
    }).catch(function() {
        return new Promise((res, rej) => rej());
    });
}




function isValidEmail(em) {
    let validchars = "0123456789qwertyuioplkjhgfdsazxcvbnm_.@";
    let indexes = [];
    indexes.push(em.indexOf("@"));
    indexes.push(em.lastIndexOf("."));
    indexes.push(em.lastIndexOf("@"));
    if (em.length < 10 || indexes[2] <= 2 || indexes[0] !== indexes[2] || indexes[1] < indexes[2]) {
        return false;
    }
    for (let i = 0; i < em.length; i++) {
        if (validchars.indexOf(em.substr(i, 1)) == -1) {
            return false;
        }
    }
    let domain = em.split(".").pop();
    if (domain !== "org" && domain !== "com" && domain !== "net" && domain !== "in") {
        return false;
    }

    return true;
}


function generateEmailConstantKey(email) {
    let constantkey = KEYS_DATA.servConstantKey;
    let encodedEmail = Buffer.from(email).toString('base64');
    const len = encodedEmail.length;
    const max = constantkey.length - 1;
    let str = ``;
    for (let i = 0; i < len; i++) {
        let index = constantkey.indexOf(encodedEmail.substr(i, 1)) + email.length;
        index = index >= max ? index - max : index;
        str = `${str}${constantkey.substr(index,1)}`;
    }

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


function emailDBcheck(em, usermode) {

    return Users.find({ email: em, activation: "_ENABLED_" }).exec().then(docs => {

        if (docs.length == 1) {
            if (usermode == "register") {
                return new Promise((resolve, reject) => reject({ error: "email" }));
            } else {
                return new Promise((resolve, reject) => resolve());
            }
        } else if (usermode == "register") {
            return new Promise((resolve, reject) => resolve());
        } else {
            return new Promise((resolve, reject) => reject({ error: "email" }));
        }
    });

}

function genActivationCode(em, apiresponse) {
    let actvCode = ``;
    for (let i = 0; i < 5; i++) {
        actvCode = `${actvCode}${Math.floor(Math.random()*10)}`;
    }

    addUserToDB(em, actvCode).then(function() {
        sendActivationMail(em, actvCode, apiresponse);
    }).catch(function() {
        apiresponse.json({ status: "email_send_fail" });

    })

}

function activation_code_verify(em, code) {

    if (code.trim() == "") {
        return new Promise((resolve, reject) => reject());
    } else {
        return Users.findOne({ email: em, activation: code }).exec().then(doc => {
            doc.activation = "_ENABLED_";
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            })
        }).catch(err => {
            return new Promise((resolve, reject) => reject());
        });
    }

}

function saveRegisterationDB(key, agent, email) {
    return Users.findOne({ email: email }).exec().then(doc => {
        doc.lastlogin = getIndDate();
        doc.browser = agent;
        doc.key = key;
        return doc.save().then(function() {
            return new Promise((resolve, rej) => resolve());
        }).catch(function() {
            return new Promise((resolve, rej) => rej());
        })

    });

}

function userAuthenticate(pskey, agent, email, mode) {

    if (mode == "login") {
        return Users.findOne({ email: email, key: pskey }).exec().then(doc => {
            doc.lastlogin = getIndDate();
            doc.browser = agent;
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            }).catch(function() {
                return new Promise((resolve, rej) => rej());
            })
        });
    } else {
        return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {
            if (doc == null) {
                return new Promise((resolve, rej) => rej());
            } else {
                return new Promise((resolve, rej) => resolve());
            }

        })

    }

}

function loadSettingsData(pskey, agent, email) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {

        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {

            let obj = {
                user_name: doc.name,
                user_photo: doc.photo,
                user_default: doc.default,
            };

            obj.user_email = email;
            let objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
            return new Promise((resolve, rej) => resolve({ data: objdata }));

        }
    })

}

function saveSettingsData(pskey, agent, email, acc_setting) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {

        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let settings = JSON.parse(Buffer.from(acc_setting, "base64").toString('ascii'));
            doc.photo = settings.profile_img;
            doc.name = settings.displayname;
            doc.default = settings.account;
            if (settings.account == "personal") {
                return doc.save().then(function() {
                    return new Promise((resolve, rej) => resolve());
                }).catch(function() {
                    return new Promise((resolve, rej) => rej());
                })
            }

        }

    })
}

function loadChartsData(pskey, agent, email, acc_setting, perMode) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            if (doc.default == "personal") {
                let datas = [];
                doc.personal.bills.forEach(function(bill) {
                    datas.push({ data: bill.data, date: bill.submitdate })
                });
                let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
                return new Promise((resolve, rej) => resolve({ chartdata: objdata }));
            } else {
                console.log("load chart for Team")
            }
        }
    }).catch(function() {
        return new Promise((resolve, rej) => rej());
    })

}

function loadUserBills(pskey, agent, email) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {

        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let obj = {};
            obj.account = doc.default;
            // if(doc.default == "personal"){
            obj.user_bills = doc.personal.bills.map(function(bill) {
                return {
                    img: bill.encr_img,
                    data: bill.data,
                    id: bill.billid,
                    lastdate: bill.submitdate
                }
            });
            console.log("user bills...");
            return new Promise((resolve, rej) => resolve({ data: obj }));
            //}

        }

    })
}



function saveUserBill(pskey, agent, email, receipt) {

    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let docBills = doc.personal.bills;
            let isDuplicates = false;
            docBills.forEach(function(bill) {
                let half1 = receipt.bill.substr(0, 2000);
                let half2 = bill.encr_img.substr(0, 2000);
                if (half1 == half2) {
                    isDuplicates = true;
                }
            });
            if (!isDuplicates) {
                docBills.push({ billid: idRandomise("bill"), encr_img: receipt.bill, data: receipt.billFields, submitdate: getIndDate() });
                doc.personal.bills = docBills;
                return doc.save().then(function() {
                    return new Promise((resolve, rej) => resolve());
                }).catch(function() {
                    return new Promise((resolve, rej) => rej());
                })
            } else {
                return new Promise((resolve, rej) => rej("duplicate"));
            }

        }

    })
}


function deleteUserBill(pskey, agent, email, bill_id) {
    console.log("To delete: " + bill_id);
    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let deletedBills = doc.personal.bills.filter(bill => (bill.billid != bill_id));
            doc.personal.bills = deletedBills;
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            }).catch(function() {
                return new Promise((resolve, rej) => rej());
            })
        }

    })
}


function updateUserBill(pskey, agent, email, bill_id, bill_data) {
    console.log("To Update: " + bill_id);

    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            console.log("update query...");
            doc.personal.bills.map(bill => {
                console.log(bill.billid);
                if (bill.billid === bill_id) {
                    bill.data = bill_data;
                    bill.submitdate = getIndDate();
                    console.log("updated: " + bill_id);
                }
            });
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            }).catch(function() {
                return new Promise((resolve, rej) => rej());
            })

        }

    }).catch(function() {
        console.log("FindOne failed")
        return new Promise((resolve, rej) => rej());
    })
}


function getIndDate() {
    const indianDate = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Calcutta'
    });
    const date = indianDate.split(",");
    const daymonthyear = date[0].split("/");
    return `${daymonthyear[1]}/${daymonthyear[0]}/${daymonthyear[2]},${date[1]}`;
}


function idRandomise(idfor) {
    let rnd = ``;
    if (idfor == "bill") {
        for (let i = 0; i < 20; i++) {
            rnd = `${rnd}${Math.floor(Math.random()*10)}`;
        }
    } else {
        let chars = "zxcvbnmlkjhgfdsaqwertyuiopQWERTYUIOPLKJHGFDSAZXCVBNM0987654321";
        for (let j = 0; j < 30; j++) {
            rnd = `${rnd}${chars.substr(Math.floor(Math.random()*chars.length),1)}`;
        }
    }
    return rnd;
}

app.get("/", (req, res) => {
    console.log("root directory");
    if (req.headers.host.indexOf("localhost") == -1) {
        if (req.secure) {
            console.log("secure");
            res.sendFile(__dirname + "/public/login.html");
        } else {
            console.log("not secure ");
            res.redirect("https://" + req.headers.host + req.url);
        }
    } else {
        res.sendFile(__dirname + "/public/login.html");
    }


});
app.get("/home", (req, res) => {
    console.log("home directory");
    if (req.headers.host.indexOf("localhost") == -1) {
        if (req.secure) {
            res.sendFile(__dirname + "/public/home.html");
        } else {
            res.redirect("https://" + req.headers.host + req.url);
        }
    } else {
        res.sendFile(__dirname + "/public/home.html");
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

app.post("/emailreq", (req, res) => {
    let email = req.body.email.toLowerCase();
    let mode = req.body.mode;

    if (isValidEmail(email)) {
        emailDBcheck(email, mode).then(function() {
            if (mode == "register") {
                genActivationCode(email, res);
            } else {
                res.json({ status: "require_pswd", e_mail: email })
            }
        }).catch(function(s) {
            if (s.error == "email") {
                if (mode == "register") {
                    res.json({ status: "email_exists" })
                } else {
                    console.log("date error2");
                    res.json({ status: "email_none" })
                }
            } else {
                res.json({ status: "busy" })
            }
        })

    } else {
        res.json({ status: "invalid" })
    }

});


app.post("/register", (req, res) => {
    const email = req.body.email.toLowerCase();
    const code = req.body.a_code;
    activation_code_verify(email, code).then(function() {
        let key = generateEmailConstantKey(email);
        res.json({ status: "activation_verified", serv_em_key: key })
    }).catch(function() {
        res.json({ status: "code_invalid" })
    })

});
app.post("/login", (req, res) => {
    const email = req.body.email.toLowerCase();
    emailDBcheck(email, "login").then(function() {
        let key = generateEmailConstantKey(email);
        res.json({ status: "email_ok", serv_em_key: key })
    }).catch(function(s) {
        if (s.error == "email") {
            res.json({ status: "email_invalid" })
        } else {
            console.log(s);
            res.json({ status: "busy" })
        }
    });
});

app.post("/storekey", (req, res) => {
    const pwdkey = req.body.serv_copy;
    const useragent = req.body.agent;
    const email = req.body.email.toLowerCase();
    saveRegisterationDB(pwdkey, useragent, email).then(function() {
        res.json({ status: "registered" });
    }).catch(function() {
        res.json({ status: "server_error" });
    })


});

app.post("/checkloginkey", (req, res) => {
    const pwdkey = req.body.serv_copy;
    const useragent = req.body.agent;
    const email = req.body.email.toLowerCase();
    userAuthenticate(pwdkey, useragent, email, "login").then(function() {
        res.json({ status: "verified" });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/userAuth", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    userAuthenticate(pwdkey, useragent, email, "auto").then(function() {
        res.json({ status: "verified" });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/loadBills", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    loadUserBills(pwdkey, useragent, email).then(function(d) {
        console.log("loaded bills");
        res.json({ status: "done", user_data: d.data });
    }).catch(function() {
        console.log("bill load fail");
        res.json({ status: "invalid" });
    })

});

app.post("/saveBill", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const bill = req.body.receipt;

    saveUserBill(pwdkey, useragent, email, bill).then(function() {
        console.log("saved 2");
        res.json({ status: "saved" });
    }).catch(function(s) {
        if (s == "duplicate") {
            res.json({ status: "duplicate_bill" })
        } else {
            res.json({ status: "invalid" })
        }

    })
});

app.post("/deleteBill", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const billid = req.body.receiptid;

    deleteUserBill(pwdkey, useragent, email, billid).then(function() {
        console.log("deleted 2");
        res.json({ status: "deleted" });
    }).catch(function() {
        console.log("cannot delete");
        res.json({ status: "invalid" });
    })

});

app.post("/updateBill", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const billid = req.body.receiptid;
    const billdata = req.body.bdata;

    updateUserBill(pwdkey, useragent, email, billid, billdata).then(function() {
        console.log("updated 2");
        res.json({ status: "updated" });
    }).catch(function() {
        console.log("cannot update");
        res.json({ status: "invalid" });
    })

});

app.post("/settingsload", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    loadSettingsData(pwdkey, useragent, email).then(function(d) {
        res.json({ status: "done", accdata: d.data })
    }).catch(function() {
        console.log("cannot load settings");
        res.json({ status: "invalid" });
    })

});

app.post("/settingsave", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const setting = req.body.usersetting;
    saveSettingsData(pwdkey, useragent, email, setting).then(function(d) {
        res.json({ status: "saved" })
    }).catch(function() {
        console.log("cannot save settings");
        res.json({ status: "invalid" });
    })

});

app.post("/addNewMember", (req, res) => {


});

app.post("/chartsload", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const personal_team = req.body.persTeam;
    loadChartsData(pwdkey, useragent, email, personal_team).then(function(c) {
        res.json({ status: "done", chartdata: c.chartdata })
    }).catch(function() {
        console.log("cannot load charts data");
        res.json({ status: "invalid" });
    })

});

app.get("/*", (req, res) => {
    res.redirect("https://" + req.headers.host + "/404.html");

});


http.listen(port, () => {
    console.log(`Server running at port ` + port);
});