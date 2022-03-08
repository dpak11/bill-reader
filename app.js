/*jshint esversion: 6*/

const express = require("express");

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const app = express();

const http = require('http').Server(app);
const port = process.env.PORT || 3000;
const KEYS_DATA = require("./keys");

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

mongoose.Promise = global.Promise;
const mongoURL = KEYS_DATA.mongodb;

let Listusers = null;
let Listteams = null;
let Categorisedbills = null;
let Uncategorisedbills = null;
let Pagevisits = mongoose.model("Pagevisits", new mongoose.Schema({
    date: String
}));

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }, function() {
    console.log("MongoDB connected");

    Listusers = mongoose.model("Listusers", new mongoose.Schema({
        email: String,
        activation: String,
        key: String,
        privilege: String,
        browser: String,
        name: String,
        photo: String,
        default: String,
        theme: String,
        created: String,
        lastlogin: String,
        personal: new mongoose.Schema({
            bills: [{ billid: String, data: String, submitdate: String }]
        })
    }));

    Listteams = mongoose.model("Listteams", new mongoose.Schema({
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
        bills: [{ billid: String, data: String, submitdate: String, status: String, logs: [] }]

    }));

    Categorisedbills = mongoose.model("Categorisedbills", new mongoose.Schema({
        email: String,
        account: String,
        project: String,
        billid: String,
        billimg: String
    }));

    Uncategorisedbills = mongoose.model("Uncategorisedbills", new mongoose.Schema({
        email: String,
        account: String,
        project: String,
        billid: String,
        billimg: String,
        billdata: String
    }));

}).catch((err) => {
    console.log("MongoDB error");
});





let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    auth: {
        user: KEYS_DATA.email,
        pass: KEYS_DATA.mailerPswd
    },    
    tls: {
        rejectUnauthorized: false
    }
});


function sendActivationMail(toEmail, code, resp) {

    let mailOptions = {
        from: KEYS_DATA.email,
        to: toEmail,
        subject: "BillVault Activation Code",
        html: `<h3>Welcome to Bill Vault</h3>
        <p>Confirm your account by entering the activation code.</p>
        <h4 style="color:blue">Your activation code is: ${code}</h4> 
        <p>&nbsp;</p>
        <p style="color:grey">Feel free to explore BillVault, and let us know if you have any suggestions that will help us improve.</p>
        <p>&nbsp;</p><p>&nbsp;</p>
        <p><b>Sincerely,</b></p>
        <b>Billvault (Admin)</b>
        `
    }

    transporter.sendMail(mailOptions, (err, data) => {

        if (err) {
            resp.json({ status: "email_send_fail" });
        } else {
            console.log("Email delivered");
            resp.json({ status: "activation_code", e_mail: toEmail });

        }
    });
}

async function addUserToDB(e_mail, actCode) {
    const users = new Listusers({
        email: e_mail,
        activation: actCode,
        key: "",
        privilege: "none",
        browser: "",
        name: "",
        photo: "",
        default: "personal",
        theme: "",
        created: getIndDate(),
        lastlogin: "",
        personal: new mongoose.Schema({
            bills: [{ billid: String, data: String, submitdate: String }]
        })
    });
    let saveduser = await users.save();
    if (saveduser) { return new Promise((resolve, rej) => resolve()) }
    return new Promise((res, rej) => rej());

}


function isValidEmail(em) {
    return (/(^[.a-z0-9_\-]{3,40})@[a-z]{3,12}\.(com|in|co.in|org|net)$/).test(em);
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

function processBillText(datarray) {
    let receiptTitle = getReceiptTitle(datarray.slice(0, 6));
    let arr = datarray.join("-|||-").toLowerCase().split("-|||-");
    let dateStr = extractBillDate(arr);
    let totalsList = arr.filter((txt) => (/(total|amt|amnt|rate|amount|payable)/).test(txt));

    let totals;
    if (totalsList.length > 0) {
        totals = extractTotalVal(totalsList, arr);
    } else {
        totals = amountNumSorter(arr)
    }
    let get_total = (totals.found == "string") ? sanitiser({ str: totals.value, isNumber: true }) : totals.value;
    return { title: receiptTitle, total: get_total, date: dateStr };

}

function getReceiptTitle(titles) {
    const topBrands = ["super market", "supermarket", "super mart", "supermart", "superstore", "super store", "hotel", "restaurant", "pvt. ltd", "pvt.ltd", "pvt ltd", "redbus", "red bus", "walmart", "family mart", "peter england", "arrow", "mochi", "vip", "hidesign", "regal", "modern bazaar", "heritage foods", "hypermart", "max", "pacific mall", "vr mall", "24x7 store", "margin free", "nilgiri", "ags rathna", "Louis Phillipe", "metro inc", "van heusen", "hamleys", "spencer's", "spencers", "spencer plaza", "food world", "reliance fresh", "more", "star bazaar", "big bazaar", "dmart", "d mart", "reliance smart", "hyper city", "spar", "shoppers stop", "forum fiza", "forum vijaya", "future retail", "lifestyle", "woodlands", "marks & spencer", "marks spencer", "sathosh super", "saravana stores", "toyota", "mercedes", "bmw"];

    let brands = topBrands.map((brand) => {
        if (titles[0].toLowerCase().indexOf(brand) >= 0) {
            return titles[0].trim()
        }
        if (titles[1].toLowerCase().indexOf(brand) >= 0) {
            return titles[1].trim()
        }
        if (titles[2].toLowerCase().indexOf(brand) >= 0) {
            return titles[2].trim()
        }
        if (titles[3].toLowerCase().indexOf(brand) >= 0) {
            return titles[3].trim()
        }
        if (titles[4].toLowerCase().indexOf(brand) >= 0) {
            return titles[4].trim()
        }
        if (titles[5].toLowerCase().indexOf(brand) >= 0) {
            return titles[5].trim()
        }
        return false;
    }).filter(brnd => brnd !== false);


    if (brands.length && brands[0]) {
        return sanitiser({ str: brands[0], isNumber: false })
    }

    return sanitiser({ str: titles[0], isNumber: false }) + " " + sanitiser({ str: titles[1], isNumber: false });
}

function extractBillDate(lines) {
    const dateFormatter = {
        getDate: function(v) {
            if (v[2].length == 2 || v[2].length == 4) {
                if (Number(v[1]) > 12) {
                    return `${v[1]}/${v[0]}/${v[2]}`;
                }
                return v.join("/");
            }
            return false;
        },
        monthNumeric: function(m) {
            return (["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m) + 1);
        }
    };

    let dates = [];
    lines.forEach((line) => {
        let l1 = line.match(/\d{1,2}\/\d{1,2}\/(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l2 = line.match(/\d{1,2}\-\d{1,2}\-(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l3 = line.match(/\d{1,2}\.\d{1,2}\.(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l4 = line.match(/\d{1,2}\-[a-z]{3}\-(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l5 = line.match(/\d{1,2}\s[a-z]{3},\s?(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l6 = line.match(/[a-z]{3}\s\d{1,2},\s?(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        let l7 = line.match(/\d{1,2}\/[a-z]{3}\/(199\d{1}|20\d{2}|0\d{1}|1\d{1}|2\d{1})\b/);
        if (l1 != null && l1.length > 1) {
            let m1 = dateFormatter.getDate(l1[0].split("/"));
            if (m1) { dates.push(m1) }
        }
        if (l2 != null && l2.length > 1) {
            let m2 = dateFormatter.getDate(l2[0].split("-"));
            if (m2) { dates.push(m2) }
        }
        if (l3 != null && l3.length > 1) {
            let m3 = dateFormatter.getDate(l3[0].split("."));
            if (m3) { dates.push(m3) }
        }
        if (l4 != null && l4.length > 1) {
            let dt = l4[0].split("-");
            dt[1] = dateFormatter.monthNumeric(dt[1]);
            let m4 = dateFormatter.getDate(dt);
            if (m4) { dates.push(m4) }
        } // 06 Jun, 2019
        if (l5 != null && l5.length > 1) {
            let dt1 = l5[0].split(","); //[06 Jun, 2019]
            let dt2 = dt1[0].split(" "); //[06,Jun]
            let dt = `${dt2[0]},${dateFormatter.monthNumeric(dt2[1])},${dt1[1].trim()}`;
            let m5 = dateFormatter.getDate(dt.split(","));
            if (m5) { dates.push(m5) }
        } // jun 12, 2010
        if (l6 != null && l6.length > 1) {
            let dt1 = l6[0].split(","); //[Jun 12, 2010]
            let dt2 = dt1[0].split(" "); //[Jun,12]
            let dt = `${dt2[1]},${dateFormatter.monthNumeric(dt2[0])},${dt1[1].trim()}`;
            let m6 = dateFormatter.getDate(dt.split(","));
            if (m6) { dates.push(m6) }
        }
        if (l7 != null && l7.length > 1) {
            let dt = l7[0].split("/");
            dt[1] = dateFormatter.monthNumeric(dt[1]);
            let m7 = dateFormatter.getDate(dt);
            if (m7) { dates.push(m7) }
        }

    });
    return dates[0]
}


function extractTotalVal(totals, alltexts) {
    let totalValue = "";
    let subs = "";
    totals.forEach((_total) => {
        let total = _total.trim();
        let subTot = total.match(/sub\s?total/);
        if (subTot !== null) { subs = total.split(subTot[0])[1] }

        let totalMatch = total.match(/(total|amt|amnt|rate|amount|payable)/);
        if (totalMatch !== null) { totalValue = total.split(totalMatch[0])[1] }

    });

    if (subs.indexOf(",") > 0) {
        subs = subs.split(",").join("");
    }

    if (totalValue.indexOf(",") > 0) {
        totalValue = totalValue.split(",").join("");
    }

    const sanitisedNum = sanitiser({ str: totalValue, isNumber: true });
    if (totalValue == "" || totalValue.indexOf(":") >= 0 || isNaN(sanitisedNum) || sanitisedNum == "") {
        if (totalValue.indexOf(":") >= 0) {
            totalValue = totalValue.split(":")[1].trim();
            if (totalValue.indexOf(" ") > 0) {
                totalValue = totalValue.split(" ")[0];
            }
            if (!isNaN(totalValue) && totalValue != "") {
                return { found: "string", value: totalValue };
            } else if (isNaN(sanitiser({ str: totalValue, isNumber: true }))) {
                if (subs.trim() != "") {
                    return { found: "string", value: subs };
                }
                return amountNumSorter(alltexts)

            }
        }
        return amountNumSorter(alltexts)
    }

    if ((totalValue == "" || isNaN(totalValue)) && subs != "") {
        return { found: "string", value: subs };
    }
    return { found: "string", value: totalValue };
}

function amountNumSorter(alltexts) {
    let newlist = alltexts.map(txt => {
        let _txt = txt.trim();
        _txt = _txt.split(",").join("");
        if (_txt.indexOf("rs.") == 0) {
            _txt = _txt.split("rs.")[1].trim();
        }

        if (!isNaN(_txt)) { _txt = Math.round(Number(_txt)) }
        if (!isNaN(_txt)) {
            if (_txt < 999999) { return _txt }
            return null;
        }
        return null;
    }).filter(numval => (numval != null && numval !== 0));

    newlist.sort((a, b) => { return b - a });
    return { found: "list", value: newlist }
}


function sanitiser({ str, isNumber }) {
    let chars = isNumber ? "0123456789." : "0123456789qwertyuioplkjhgfdsazxcvbnm. &QWERTYUIOPLKJHGFDSAZXCVBNM-";
    let newchar = "";
    for (let i = 0; i < str.length; i++) {
        let txt = str.substr(i, 1);
        if (chars.indexOf(txt) >= 0) {
            newchar = newchar + txt;
        }
    }
    return newchar;
}


async function emailDBcheck(em, usermode) {
    let activatedUser = await Listusers.find({ email: em, activation: "_ENABLED_" });
    if (activatedUser.length == 1) {
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
}

function genActivationCode(em, apiresponse) {
    let actvCode = ``;
    for (let i = 0; i < 5; i++) {
        actvCode = `${actvCode}${Math.floor(Math.random()*10)}`;
    }

    addUserToDB(em, actvCode).then(() => {
        sendActivationMail(em, actvCode, apiresponse);
    }).catch(() => {
        apiresponse.json({ status: "email_send_fail" });

    })

}

async function activation_code_verify(em, code) {
    if (code.trim() == "") {
        return new Promise((resolve, reject) => reject());
    }
    let actCodeUser = await Listusers.findOne({ email: em, activation: code });
    if (!actCodeUser) { return new Promise((resolve, reject) => reject()) }
    actCodeUser.activation = "_ENABLED_";
    let savedActivation = await actCodeUser.save();
    if (savedActivation) { return Promise.resolve() }
    return new Promise((resolve, reject) => reject());
}

async function saveRegisterationDB(key, agent, email) {
    let userEmail = await Listusers.findOne({ email: email });
    if (userEmail) {
        userEmail.lastlogin = getIndDate();
        userEmail.browser = agent;
        userEmail.key = key;
        savedEmail = await userEmail.save();
        if (savedEmail) { return Promise.resolve() }
        return new Promise((resolve, rej) => rej());
    }
}

async function userAuthenticate(pskey, agent, email, mode) {

    if (mode == "login") {
        let userAuthKey = await Listusers.findOne({ email: email, key: pskey });
        if (!userAuthKey) { return new Promise((resolve, rej) => rej()) }
        userAuthKey.lastlogin = getIndDate();
        userAuthKey.browser = agent;
        let userSave = await userAuthKey.save();
        if (userSave) { return Promise.resolve() }
        return new Promise((resolve, rej) => rej());

    } else {
        let autoUserAuth = await Listusers.findOne({ email: email, key: pskey, browser: agent });
        if (autoUserAuth) { return new Promise((resolve, rej) => resolve()) }
        return new Promise((resolve, rej) => rej());
    }

}

async function loadProjectMembers(pskey, agent, email, proj) {
    let getValidUser = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!getValidUser) { return new Promise((resolve, rej) => rej()) }
    let getProjects = await Listteams.find({ teamid: proj });
    let myrole = getProjects.filter(m => m.user_email == email)[0].role;
    let approvers = getProjects.map(t => {
        if (t.role == "manager" || t.role == "admin") {
            return t.user_email;
        }
        return false;
    }).filter(f => f != false);

    let list = getProjects.map(tm => {
        if (myrole == "manager") {
            if (tm.approver == email) {
                return {
                    role: tm.role,
                    member: tm.user_email,
                    approver: tm.approver,
                    updated: tm.logs
                }
            }
            return false;
        }
        if (myrole == "admin" && tm.role != "admin") {
            return {
                role: tm.role,
                member: tm.user_email,
                approver: tm.approver,
                updated: tm.logs
            }
        }
        return false;
    }).filter(f => f != false);
    return Promise.resolve({ data: JSON.stringify({ approvers: approvers, teamlist: list }) });

}

async function loadSettingsData(pskey, agent, email) {
    let getValidUser = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!getValidUser) {
        return new Promise((resolve, rej) => rej());
    }

    let obj = {
        user_name: getValidUser.name,
        user_photo: getValidUser.photo,
        user_default: getValidUser.default,
        user_email: getValidUser.email
    };
    let objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
    if (getValidUser.default == "team") {
        let myteam = await Listteams.find({ user_email: getValidUser.email });
        obj.teamlist = [];
        objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
        if (myteam.length > 0) {
            let teams = myteam.map(tm => {
                return {
                    id: tm.teamid,
                    projname: tm.title
                }
            });
            obj.teamlist = teams;
            objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
            return Promise.resolve({ data: objdata });
        }
        return Promise.resolve({ data: objdata });
    }
    return Promise.resolve({ data: objdata });

}


async function saveSettingsData(pskey, agent, email, acc_setting) {
    let getValidUser = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!getValidUser) {
        return new Promise((resolve, rej) => rej());
    }
    let settings = JSON.parse(Buffer.from(acc_setting, "base64").toString('ascii'));
    getValidUser.photo = settings.profile_img;
    getValidUser.name = settings.displayname;
    getValidUser.default = settings.account;
    if (settings.isSwitchedProj == "yes") {
        let allpromises = [];
        let mydocs = await Listteams.find({ user_email: email });
        if (mydocs.length > 0) {
            mydocs.map((mydoc, i) => {
                if (mydoc.teamid == settings.newProjectID) {
                    mydoc.default = "yes";
                } else {
                    mydoc.default = "no";
                }
                allpromises[i] = mydoc.save().then(() => Promise.resolve({ status: "done" }));
            });
            return Promise.all(allpromises).then(() => {
                return getValidUser.save().then(() => Promise.resolve({ status: "done" }))

            });
        }
    } else {
        if (settings.insertedOneVals != "none") {
            if (!isValidEmail(settings.insertedOneVals.member) || !isValidEmail(settings.insertedOneVals.approver)) {
                return Promise.resolve({ status: "invalidEmail" });
            }

            let projname = settings.insertedOneVals.projName;
            let projlogo = settings.insertedOneVals.logo;
            if (settings.editedProjectVals != "none") {
                if (settings.editedProjectVals.logo != "") { projlogo = settings.editedProjectVals.logo }
                if (settings.editedProjectVals.projName != "") { projlogo = settings.editedProjectVals.projName }
            }
            let addMemberProj = await addMemberToProject(pskey, agent, email, settings.insertedOneVals.member, settings.insertedOneVals.role, settings.insertedOneVals.approver, settings.insertedOneVals.projid, projname, projlogo);
            if (addMemberProj.status == "done") {
                if (settings.editedProjectVals != "none") {
                    return updateEditedProject(settings.editedProjectVals, email).then(() => {
                        return getValidUser.save().then(() => Promise.resolve({ status: "done" }))
                    });
                } else {
                    return getValidUser.save().then(() => Promise.resolve({ status: "done" }))
                }
            } else {
                return Promise.resolve(addMemberProj);
            }

        } else if (settings.editedProjectVals != "none") {
            return updateEditedProject(settings.editedProjectVals, email).then(() => {
                return getValidUser.save().then(() => Promise.resolve({ status: "done" }))
            });

        } else {
            return getValidUser.save().then(() => Promise.resolve({ status: "done" }))
        }
    }

}


async function updateEditedProject(editedproj, manager_admin) {
    let projEditedList = await Listteams.find({ teamid: editedproj.projid });
    if (projEditedList.length > 0) {
        let promises = [];
        let users = editedproj.users;
        let counter = 0;
        projEditedList.forEach((team) => {
            if (editedproj.logo != "") {
                team.logo = editedproj.logo;
            }
            if (editedproj.projName != "") {
                team.title = editedproj.projName;
            }

            let user = users.filter(em => (em.email == team.user_email));
            if (user.length == 1) {
                team.approver = user[0].approver;
                team.logs = [`<b>Modified by:</b> ${manager_admin} on ${getIndDate()}`];
            }
            if (user.length == 1 || editedproj.logo != "" || editedproj.projName != "") {
                promises[counter] = team.save().then(() => new Promise((resolve, rej) => resolve()));
                counter++;
            }

        });
        return Promise.all(promises).then(() => {
            return Promise.resolve();

        });
    }
}

async function loadChartsData(pskey, agent, email, perMode) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    if (userDoc.default == "personal") {
        let datas = [];
        userDoc.personal.bills.forEach((bill) => {
            datas.push({ data: bill.data, date: bill.submitdate })
        });
        let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
        return Promise.resolve({ chartdata: objdata });
    } else if (perMode == "private") {
        let onedoc = await Listteams.findOne({ user_email: email, default: "yes" });
        if (!onedoc) {
            return new Promise((resolve, rej) => rej("nochartdata"));
        }
        let datas = [];
        onedoc.bills.forEach(bill => {
            if (bill.status == "approved") {
                datas.push({ data: bill.data, date: bill.submitdate });
            }
        });
        let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
        return Promise.resolve({ chartdata: objdata });

    } else if (perMode == "team") {
        let tdoc = await Listteams.findOne({ user_email: email, default: "yes" });
        if (!tdoc) {
            return new Promise((resolve, rej) => rej("nochartdata"));
        }
        let project = tdoc.teamid;
        let myrole = tdoc.role;
        let tdoc1 = await Listteams.find({ teamid: project });
        if (tdoc1.length == 0) {
            return new Promise((resolve, rej) => rej("invalid"));
        }
        let team = null;
        if (myrole == "admin") {
            team = tdoc1.filter(docs => (docs.role != "admin"));
        }
        if (myrole == "manager") {
            team = tdoc1.filter(docs => (docs.approver == email));
        }
        if (myrole == "member") {
            team = tdoc1.filter(docs => (docs.user_email == email));
        }

        let datas = [];
        team.forEach(tm => {
            tm.bills.filter(bill => (bill.status == "approved")).forEach(bdoc => {
                datas.push({
                    date: bdoc.submitdate,
                    data: bdoc.data,
                    user: tm.user_email,
                    role: tm.role
                });
            });
        });
        let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
        return Promise.resolve({ chartdata: objdata });
    }

}

async function createNewProject(pskey, agent, email, proj, logoimg) {
    let maxProjLimit = 5;
    let userdoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (userdoc.default == "team" && userdoc.privilege == "all") {
        let doc1 = await Listteams.find({ user_email: email, role: "admin" });
        if (doc1.length == maxProjLimit) {
            return new Promise((res, rej) => rej({ state: "maxlimit", maxVal: maxProjLimit }));
        }
        if (doc1.length < maxProjLimit) {
            let isDefault = (doc1 == null || doc1.length == 0) ? "yes" : "no";
            let onedoc = await Listteams.find({ title: proj });
            if (onedoc.length == 0) {
                let projID = idRandomise("teamid");
                let date_now = getIndDate();
                let newproject = new Listteams({
                    teamid: projID,
                    logo: logoimg,
                    title: proj,
                    user_email: email,
                    role: "admin",
                    default: isDefault,
                    created: date_now,
                    lastlogin: date_now,
                    approver: email,
                    logs: [],
                    bills: []
                });
                return newproject.save().then(() => {
                    return Promise.resolve(projID);
                });
            } else {
                return new Promise((res, rej) => rej({ state: "duplicateProject" }));
            }

        }
    }

}

async function addMemberToProject(pskey, agent, email, newMemberEmail, memberRole, approver, project, project_name, logoimg) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (userDoc.default == "team" && userDoc.privilege == "all") {
        let s1 = await teamMemberValidation(newMemberEmail);
        let userState = s1.state;
        if (userState == "nouser") {
            return Promise.resolve({ status: userState, msg: `${newMemberEmail} is not registered to BillVault` })
        }
        let s2 = await teamMemberValidation(approver);
        if (s2.state == "nouser") {
            return Promise.resolve({ status: s2.state, msg: `${approver} is not registered to BillVault` });
        }
        let teamem1 = await Listteams.findOne({ user_email: newMemberEmail, teamid: project });
        if (!teamem1) {
            return addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver).then(async () => {
                let teamem2 = await Listteams.findOne({ user_email: approver, teamid: project });
                if (!teamem2) {
                    return addToTeam(project, logoimg, project_name, approver, "manager", email).then(() => Promise.resolve({ status: "done" }));
                } else if (teamem2.role == "member") {
                    return Listteams.deleteOne({ user_email: newMemberEmail, teamid: project }).exec().then(() => {
                        return Promise.resolve({ status: "declineMemberRole", msg: `Already assigned Member(${approver}) can not be re-assigned "Manager" Role` });
                    });

                } else {
                    teamem2.role = (teamem2.role == "admin") ? "admin" : "manager";
                    return teamem2.save().then(() => Promise.resolve({ status: "done" }))

                }
            });

        } else if (teamem1.role == "manager") {
            if (memberRole == "member") {
                return Promise.resolve({ status: "preassigned", msg: `Can not re-assign Manager "${newMemberEmail}" as a Member` });
            } else {
                let team_appr = await Listteams.findOne({ user_email: approver, teamid: project });
                if (!team_appr) {
                    return addToTeam(project, logoimg, project_name, approver, "manager", email).then(() => {
                        teamem1.approver = approver;
                        return teamem1.save().then(() => Promise.resolve({ status: "done" }));
                    });
                } else if (team_appr.role == "manager" || team_appr.role == "admin") {
                    if (teamem1.approver == approver) {
                        return Promise.resolve({ status: "preassigned", msg: `Error: Duplicate Assignment` });
                    } else {
                        teamem1.approver = approver;
                        return teamem1.save().then(() => Promise.resolve({ status: "done" }));
                    }
                } else {
                    return Promise.resolve({ status: "preassigned", msg: `Can not re-assign Member "${approver}" as approver` });
                }
            }

        } else {
            return Promise.resolve({ status: "preassigned", msg: `${newMemberEmail} is already assigned to this Project` })
        }

    }
}

async function teamMemberValidation(member) {
    let memdoc = await Listusers.findOne({ email: member, activation: "_ENABLED_" });
    if (!memdoc) {
        return Promise.resolve({ state: "nouser" });
    }
    return Promise.resolve({ state: "allowuser" });
}

async function addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver) {
    let state = await getDefaultTeam(newMemberEmail);
    let date_now = getIndDate();
    let newproject = new Listteams({
        teamid: project,
        logo: logoimg,
        title: project_name,
        user_email: newMemberEmail,
        role: memberRole,
        default: state.default,
        created: date_now,
        lastlogin: "",
        approver: approver,
        logs: [],
        bills: []
    });
    return newproject.save().then(() => Promise.resolve());
}

async function getDefaultTeam(user) {
    let listeam = await Listteams.findOne({ user_email: user });
    if (!listeam) {
        return Promise.resolve({ default: "yes" });
    } else {
        return Promise.resolve({ default: "no" });
    }
}

async function setDefaultTeam(user) {
    let listeam = await Listteams.find({ user_email: user });
    if (listeam.length == 0) {
        return Promise.resolve();
    }
    let defaults = listeam.filter(tm => (tm.default == "yes"));
    if (defaults.length == 0) {
        listeam[0].default = "yes";
        return listeam[0].save().then(() => Promise.resolve());
    } else {
        return Promise.resolve();
    }

}

async function removeProjectMember(pwdkey, useragent, email, project, member) {
    let doc = await Listusers.findOne({ email: email, key: pwdkey, browser: useragent });
    if (!doc) { return new Promise((resolve, rej) => rej()) }
    let teamdoc = await Listteams.findOne({ user_email: member, teamid: project });
    if (teamdoc) {
        let allowdeletion = true;
        teamdoc.bills.forEach(bill => {
            if (bill.status == "approved") {
                allowdeletion = false;
            }
        });
        if (!allowdeletion) {
            return Promise.resolve("denied");
        }

        let deleteProj = await Listteams.deleteOne({ user_email: member, teamid: project });
        return setDefaultTeam(member).then(async () => {
            if (teamdoc.role == "manager") {
                // If manager is deleted, then assign admin as the default bill approver to replace this manager
                let promises = [];
                let tm = await Listteams.find({ approver: member, teamid: project });
                if (tm.length == 0) {
                    return Promise.resolve("deleted-manager");
                }
                tm.forEach((mem, i) => {
                    mem.approver = email; // set admin email as approver
                    mem.logs = [`<b>Modified by:</b> ${email} on ${getIndDate()}`];
                    promises[i] = mem.save().then(() => Promise.resolve());
                });

                return Promise.all(promises).then(() => {
                    return Promise.resolve("deleted-manager");
                });

            } else {
                return Promise.resolve("deleted-member");
            }
        });

    }

}


function removeProject(pwdkey, useragent, email, project) {
    return Listteams.deleteOne({ teamid: project }).exec().then((del) => {
        return new Promise((resolve, rej) => resolve());
    }).catch(err => new Promise((resolve, rej) => rej()))

}

async function loadUncategorisedBills(pskey, agent, email, project, account) {
    const findParams = { email: email, account: account }
    if (account == "team") {
        findParams.project = project;
    }
    let uncategorisedDocs = await Uncategorisedbills.find(findParams)
    if (uncategorisedDocs.length == 0) {
        return Promise.resolve([])
    }
    const UNCTG_bills = [];
    uncategorisedDocs.forEach((billdoc) => {
        UNCTG_bills.push({
            bill_id: billdoc.billid,
            billimg: billdoc.billimg,
            billdata: billdoc.billdata
        })
    });
    return Promise.resolve(UNCTG_bills);

}

async function fetchBillImages({ objList = null, insertkey = null, searchid = "", project = "", account = "personal", email = "" }) {
    
    const findParams = { account, email };
    if (project !== "" && account == "team") {
        findParams.project = project
    }
    const _obj = [...objList];

    let promises = [];
    let prevTimestamp = Date.now();
    _obj.forEach((o, i) => {
        const fParams = { ...findParams };
        fParams.billid = o[searchid];
        const startdate = Date.now();
        promises[i] = Categorisedbills.findOne(fParams).exec().then((cb) => {
            _obj[i][insertkey] = cb.billimg;
            const ts = (Date.now() - prevTimestamp) / 1000;
            prevTimestamp = Date.now();
            return Promise.resolve(ts);
        })

    });
    let allpromises = await Promise.all(promises);
    return Promise.resolve(_obj);

}

function attachBillPointer(o, pointer) {
    if (o.user_bills.length > 6) {
        o.user_bills = o.user_bills.splice(pointer, 6);
        if (o.user_bills.length === 6) {
            o.nextPointerAt = pointer + 6;
        }
    }
}

async function loadUserBills(pskey, agent, email, mode, billPointer = 0, teamloopPoint = 0) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) { return new Promise((resolve, rej) => rej()) }

    let obj = {};
    obj.account = userDoc.default;
    obj.controls = userDoc.privilege;
    obj.defaultskin = userDoc.theme;
    obj.isGlobalAdmin = (userDoc.privilege == "all") ? "yes" : "no";
    if (userDoc.default == "personal") {
        obj.user_bills = userDoc.personal.bills.map((bill) => {
            return {
                data: bill.data,
                id: bill.billid,
                lastdate: bill.submitdate
            }
        });

        attachBillPointer(obj, billPointer);
        obj.user_bills = await fetchBillImages({ objList: obj.user_bills, insertkey: "img", searchid: "id", email });
        return Promise.resolve({ data: obj });

    } else {
        let teamdoc = await Listteams.find({ user_email: email });
        if (teamdoc.length == 0) {
            return new Promise((resolve, rej) => rej({ status: "notinteam", data: obj }));
        }
        obj.activeProjectID = "";
        if (mode == "private") {           
            teamdoc.forEach((tdoc) => {
                if (tdoc.default == "yes") {
                    obj.activeProjectID = tdoc.teamid;
                    obj.logo = tdoc.logo;
                    obj.projname = tdoc.title;
                    obj.role = tdoc.role;
                    obj.controls = (tdoc.role == "admin") ? "all" : "none";
                    obj.user_bills = tdoc.bills.map((bill) => {
                        return {
                            data: bill.data,
                            id: bill.billid,
                            lastdate: bill.submitdate,
                            status: bill.status,
                            history: bill.logs,
                            approver: tdoc.approver,
                            useremail: tdoc.user_email
                        }
                    });
                }
            });

            attachBillPointer(obj, billPointer);
            obj.user_bills = await fetchBillImages({
                objList: obj.user_bills,
                insertkey: "img",
                searchid: "id",
                account: "team",
                project: obj.activeProjectID,
                email
            });

            return Promise.resolve({ data: obj });
        }

        if (mode == "team") {
            teamdoc.forEach((tdoc) => {
                if (tdoc.default == "yes") {
                    obj.activeProjectID = tdoc.teamid;
                    obj.role = tdoc.role;
                    obj.logo = tdoc.logo;
                    obj.projname = tdoc.title;
                    obj.controls = (tdoc.role == "admin") ? "all" : "none";
                }
            });

            if (obj.activeProjectID == "") {
                return Promise.resolve({ data: obj });
            } else {
                let alldocs = await findAllBillsFromProject(obj.activeProjectID, obj.controls, email, obj.role, billPointer, teamloopPoint);
                obj.allProj = alldocs;
                return Promise.resolve({ data: obj });
            }
        }

    }
}


async function findAllBillsFromProject(id, controls, email, roles, pointer, teamloopPoint) {
   
    let teamdoc = await Listteams.find({ teamid: id });
    let allProjMembers = [];
    let loopPoint;
    let max = (pointer != 0) ? 12 : 6; 
    let loopStartAt = (pointer != 0 && teamloopPoint>0) ? teamloopPoint - 1 : teamloopPoint; 
    let splicePoint = pointer;

    for (let i = loopStartAt; i < teamdoc.length; i++) {
        let doc = teamdoc[i];     
        if (controls == "all") {
            if (doc.role !== "admin") {
                let billdocs = await getTeamData(doc, id);
                allProjMembers.push(...billdocs)
            }
        } else if (roles == "manager") {
            if (doc.approver == email) {
                let billdocs = await getTeamData(doc, id);
                allProjMembers.push(...billdocs)
            }
        } else if (doc.user_email == email) {
            let billdocs = await getTeamData(doc, id);
            allProjMembers.push(...billdocs)
        }

        if (pointer != 0) {
            loopPoint = i;
            splicePoint = allProjMembers.findIndex((projbill, j) => {
                return projbill.id == pointer
            });   
        }
        if (allProjMembers.length > max) {
            loopPoint = i;
            break;
        }

    }

    const extracted = allProjMembers.splice(splicePoint, 6);
    const allProjs = {
        user_bills: extracted,
        loopPoint
    };

    if (splicePoint >= 0) {
        allProjMembers.splice(0, splicePoint);
    }
    
    if (allProjMembers.length > 0) {
        allProjs.nextPointerAt = allProjMembers[0].id
    } 
    if (allProjMembers.length == 0 && loopPoint < (teamdoc.length-1)) {
    	let oDoc = await getTeamData(teamdoc[loopPoint+1], id);
    	allProjs.nextPointerAt = oDoc[0].id;
    	allProjs.loopPoint = loopPoint+1
    }
    return Promise.resolve(allProjs);
}

async function getTeamData(team_doc, team_id) {
    let projUserbills = team_doc.bills.map(bill => {
        return {
            data: bill.data,
            id: bill.billid,
            lastdate: bill.submitdate,
            status: bill.status,
            history: bill.logs,
            approver: team_doc.approver,
            useremail: team_doc.user_email,
            role: team_doc.role
        }
    });

    if (projUserbills.length == 0) {
        return Promise.resolve([])
    }


    projUserbills = await fetchBillImages({
        objList: projUserbills,
        insertkey: "img",
        searchid: "id",
        account: "team",
        project: team_id,
        email: team_doc.user_email
    });
    return Promise.resolve(projUserbills)
}

function loadRemainingUserBills(pskey, agent, email, mode, billPointer, loopPoint) {
    return loadUserBills(pskey, agent, email, mode, billPointer, loopPoint).then((remaining) => {
        const obj = {}
        if (remaining.data.allProj) {
            obj.nextPointerAt = remaining.data.allProj.nextPointerAt || null;
            obj.loopPoint = remaining.data.allProj.loopPoint;
            obj.user_bills = remaining.data.allProj.user_bills
        } else {
            obj.nextPointerAt = remaining.data.nextPointerAt || null;
            obj.user_bills = remaining.data.user_bills
        }

        return Promise.resolve(obj)
    })
}


async function saveUserBill(pskey, agent, email, receipt) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    if (userDoc.default == "personal") {
        let docBills = userDoc.personal.bills;
        let isDuplicates = false;
        let imgHalf1 = receipt.bill.substr(0, 2000);
        let billDocs = await Categorisedbills.find({ email: email, account: "personal" });
        if (billDocs.length > 0) {
            isDuplicates = billDocs.some((bill) => {
                let imgHalf2 = bill.billimg.substr(0, 2000);
                return (imgHalf1 === imgHalf2)
            })

        }

        if (isDuplicates) {
            return new Promise((resolve, rej) => rej("duplicate"));
        }

        const newBillID = idRandomise("bill");
        docBills.push({ billid: newBillID, data: receipt.billFields, submitdate: getIndDate() });
        userDoc.personal.bills = docBills;
        return userDoc.save().then(() => {
            const billImgNew = new Categorisedbills({
                email: email,
                account: "personal",
                project: "",
                billid: newBillID,
                billimg: receipt.bill
            });
            return billImgNew.save().then(() => Promise.resolve());
        });

    } else {
        let teamdoc = await Listteams.find({ user_email: email });
        if (teamdoc.length == 0) {
            return new Promise((resolve, rej) => rej());
        }
        let promisecall = [];
        let half1 = receipt.bill.substr(0, 2000);
        for (let i = 0; i < teamdoc.length; i++) {
            const tdoc = teamdoc[i];
            if (tdoc.default == "yes") {
                let isDuplicates = false;
                if (tdoc.bills.length > 0) {
                    let billTeamDocs = await Categorisedbills.find({ email: email, account: "team", project: tdoc.teamid });
                    isDuplicates = billTeamDocs.some((bill) => {
                        let half2 = bill.billimg.substr(0, 2000);
                        return half1 === half2;
                    });
                }

                if (isDuplicates) {
                    return new Promise((resolve, rej) => rej("duplicate"));
                }

                const submDate = getIndDate();
                const newBillID = idRandomise("bill");
                tdoc.lastlogin = submDate;
                tdoc.bills.push({
                    billid: newBillID,
                    data: receipt.billFields,
                    submitdate: submDate,
                    status: "pending",
                    logs: ["Bill Submitted on: " + submDate]
                });
                return tdoc.save().then(() => {
                    const billImgNew = new Categorisedbills({
                        email: email,
                        account: "team",
                        project: tdoc.teamid,
                        billid: newBillID,
                        billimg: receipt.bill
                    });
                    return billImgNew.save().then(() => Promise.resolve());
                });

            }
        }

    }

}


async function saveUncategorisedBills(pskey, agent, email, uncategorised) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    const { accountType, projectID, bills } = uncategorised;
    let promises = [];
    bills.forEach((unc_bill, i) => {
        const { bill_id, billData, bill } = unc_bill;
        const newbill = new Uncategorisedbills({
            email: email,
            account: accountType,
            project: projectID,
            billid: bill_id,
            billimg: bill,
            billdata: billData
        });
        promises[i] = newbill.save().then(() => {
            return Promise.resolve();
        });

    });
    return Promise.all(promises).then(() => Promise.resolve())

}


async function deleteUncategorisedBill(pskey, agent, email, uncategorised) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    const { accountType, projectID, id } = uncategorised;

    return Uncategorisedbills.deleteOne({ email: email, account: accountType, project: projectID, billid: id }).exec().then(() => Promise.resolve());

}

async function deleteUserBill(pskey, agent, email, bill_id) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    } else if (userDoc.default == "personal") {
        let deletedBills = userDoc.personal.bills.filter(bill => (bill.billid != bill_id));
        userDoc.personal.bills = deletedBills;
        return userDoc.save().then(() => {
            return Categorisedbills.deleteOne({ email: email, billid: bill_id, account: "personal" }).then(() => Promise.resolve())
        })
    } else {
        let teamdoc = await Listteams.findOne({ user_email: email, default: "yes" });
        if (!teamdoc) {
            return new Promise((resolve, rej) => rej());
        }
        let deletedBills = teamdoc.bills.filter(bill => (bill.billid != bill_id));
        teamdoc.bills = deletedBills;
        return teamdoc.save().then(() => {
            return Categorisedbills.deleteOne({ email: email, billid: bill_id, account: "team", project: teamdoc.teamid }).then(() => Promise.resolve())
        });
    }
}


async function updateUserBill(pskey, agent, email, bill_id, bill_data) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    if (userDoc.default == "personal") {
        userDoc.personal.bills.map(bill => {
            if (bill.billid === bill_id) {
                bill.data = bill_data;
                bill.submitdate = getIndDate();
            }
        });
        return userDoc.save().then(() => Promise.resolve());
    } else {
        let teamdoc = await Listteams.findOne({ user_email: email, default: "yes" });
        if (!teamdoc) {
            return new Promise((resolve, rej) => rej());
        }
        teamdoc.bills.map(bill => {
            if (bill.billid === bill_id) {
                let modDate = getIndDate();
                bill.data = bill_data;
                bill.submitdate = modDate;
                bill.status = "pending";
                bill.logs.push("Bill Updated on: " + modDate);
            }
        });
        return teamdoc.save().then(() => Promise.resolve());
    }
}

async function approveRejectUserBill(pskey, agent, email, bill_id, proj, user, mode, bill_amt, bill_name) {
    let userDoc = await Listusers.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    let team = await Listteams.findOne({ user_email: user, teamid: proj });
    if (!team) {
        return new Promise((resolve, rej) => rej());
    }
    team.bills.map(bill => {
        if (bill.billid === bill_id) {
            let logval = "Bill " + mode + " by " + userDoc.name + " (" + email + ") on: " + getIndDate();
            bill.logs.push(logval);
            bill.status = mode;
        }
    });
    let saveStatus = await team.save();
    let notification = await sendBillStatusNotification(email, user, mode, team.title, bill_amt, bill_name);
    return Promise.resolve({ status: mode });

}

function sendBillStatusNotification(approver, member, billstatus, projName, billAmt, billName) {
    let capsBillStatus = (billstatus == "approved") ? "Approved" : "Rejected";
    let mailOptions = {
        from: KEYS_DATA.email,
        to: member,
        subject: `Your Bill receipt got ${capsBillStatus}`,
        html: `
        <p>Your Bill <b>${billName}</b> got <b>${billstatus}</b></p>
        <p>Project Name: ${projName}</p>
        <p>${capsBillStatus} by: ${approver}</p>
        <p>Bill Amount: ${billAmt}</p>
        <p>&nbsp;</p>
        <p>(For further information please log into BillVault app)</p>
        <p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>
        <p>Sincerely,<br>
        BillVault (Admin)</p>
        `
    };
    return new Promise((resolve, rej) => {
        transporter.sendMail(mailOptions, (err, data) => {
            if (err) {
                resolve("failed")
            } else {
                resolve("notified")
            }
        });
    });

}

function saveDefaultTheme(pskey, agent, email, theme) {
    return Listusers.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        doc.theme = theme;
        doc.save().then(() => new Promise((resolve, rej) => resolve()))
    });
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
        for (let j = 0; j < 20; j++) {
            rnd = `${rnd}${chars.substr(Math.floor(Math.random()*chars.length),1)}`;
        }
    }
    return rnd;
}

function getEmail(email) {
    let em = Buffer.from(email, "base64").toString('ascii');
    return em.toLowerCase();
}




app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");
    if (typeof KEYS_DATA.allowAdminRights == "undefined") {
        let ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.connection.remoteAddress;
        let pagevisit = new Pagevisits({
            date: `${getIndDate()}  -  (IP: ${ip})`
        });
        pagevisit.save();
    }

});
app.get("/home", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");
});

app.get("/get-my-users", (req, res) => {
    res.sendFile(__dirname + "/public/myuserlists.html");
});


app.post("/processTextData", (req, res) => {
    res.json({ status: processBillText(req.body.imgtext) });

});

app.post("/emailreq", async (req, res) => {
    const email = getEmail(req.body.email);
    const mode = req.body.mode;
    if (isValidEmail(email)) {
        try {
            const userEmailDB = await emailDBcheck(email, mode);
            if (mode == "register") {
                genActivationCode(email, res);
            } else {
                res.json({ status: "require_pswd", e_mail: email })
            }
        } catch (e) {
            if (e.error == "email") {
                if (mode == "register") {
                    res.json({ status: "email_exists" })
                } else {
                    res.json({ status: "email_none" })
                }
            } else {
                res.json({ status: "busy" })
            }
        }
    } else {
        res.json({ status: "invalid" })
    }

});


app.post("/register", (req, res) => {
    const email = getEmail(req.body.email);
    const code = req.body.a_code;
    activation_code_verify(email, code).then(() => {
        let key = generateEmailConstantKey(email);
        res.json({ status: "activation_verified", serv_em_key: key })
    }).catch(() => {
        res.json({ status: "code_invalid" })
    })

});
app.post("/login", (req, res) => {
    const email = getEmail(req.body.email);
    emailDBcheck(email, "login").then(() => {
        let key = generateEmailConstantKey(email);
        res.json({ status: "email_ok", serv_em_key: key })
    }).catch((s) => {
        if (s.error == "email") {
            res.json({ status: "email_invalid" })
        } else {
            res.json({ status: "busy" })
        }
    });
});

app.post("/storekey", (req, res) => {
    const pwdkey = req.body.serv_copy;
    const useragent = req.body.agent;
    const email = getEmail(req.body.email);
    saveRegisterationDB(pwdkey, useragent, email).then(() => {
        res.json({ status: "registered" });
    }).catch(() => {
        res.json({ status: "server_error" });
    })


});

app.post("/checkloginkey", (req, res) => {
    const pwdkey = req.body.serv_copy;
    const useragent = req.body.agent;
    const email = getEmail(req.body.email);
    userAuthenticate(pwdkey, useragent, email, "login").then(() => {
        res.json({ status: "verified" });
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/userAuth", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = getEmail(req.body.em);
    userAuthenticate(pwdkey, useragent, email, "auto").then(() => {
        res.json({ status: "verified" });
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/loadBills", (req, res) => {
    const { em, agent, key_serv, ptype } = req.body;
    loadUserBills(key_serv, agent, getEmail(em), ptype).then(d => {
        res.json({ status: "done", user_data: d.data });
    }).catch((s) => {
        if (s.status == "notinteam") {
            res.json({ status: "notinteam", user_data: s.data });
        } else {
            res.json({ status: "invalid" });
        }

    })

});

app.post("/loadRemainingBills", (req, res) => {
    const { em, agent, key_serv, ptype, pointer, loopPoint } = req.body;
    loadRemainingUserBills(key_serv, agent, getEmail(em), ptype, pointer, loopPoint).then(remaningBills => {
        res.json({ status: "done", remaining: remaningBills });
    }).catch((s) => {
        if (s.status == "notinteam") {
            res.json({ status: "notinteam", user_data: s.data });
        } else {
            res.json({ status: "invalid" });
        }

    })

});


app.post("/loadUncategorised", (req, res) => {
    const { em, agent, key_serv, project, account } = req.body;
    loadUncategorisedBills(key_serv, agent, getEmail(em), project, account).then(uBills => {
        res.json({ status: "done", bills: uBills });
    }).catch((s) => {
        res.json({ status: "invalid" });

    })

});

app.post("/saveBill", (req, res) => {
    const { em, agent, key_serv, receipt } = req.body;
    saveUserBill(key_serv, agent, getEmail(em), receipt).then(() => {
        res.json({ status: "saved" });
    }).catch((s) => {
        if (s == "duplicate") {
            res.json({ status: "duplicate_bill" })
        } else {
            res.json({ status: "invalid" })
        }

    })
});


app.post("/saveUncategorised", (req, res) => {
    const { em, agent, key_serv, uncategorised } = req.body;
    saveUncategorisedBills(key_serv, agent, getEmail(em), uncategorised).then(() => {
        res.json({ status: "saved" });
    }).catch((s) => {
        res.json({ status: "invalid" })
    })
});


app.post("/deleteUncategorised", (req, res) => {
    const { em, agent, key_serv, uncategorised } = req.body;
    deleteUncategorisedBill(key_serv, agent, getEmail(em), uncategorised).then(() => {
        res.json({ status: "deleted" });
    }).catch((s) => {
        res.json({ status: "invalid" })
    })
});

app.delete("/deleteBill", (req, res) => {
    const { em, agent, key_serv, receiptid } = req.body;
    deleteUserBill(key_serv, agent, getEmail(em), receiptid).then(() => {
        res.json({ status: "deleted" });
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/updateBill", (req, res) => {
    const { em, agent, key_serv, receiptid, bdata } = req.body;
    updateUserBill(key_serv, agent, getEmail(em), receiptid, bdata).then(() => {
        res.json({ status: "updated" });
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/approveRejectBill", (req, res) => {
    const { em, agent, key_serv, billid, proj, user, mode, amount, billname } = req.body;
    approveRejectUserBill(key_serv, agent, getEmail(em), billid, proj, user, mode, amount, billname).then((s) => {
        res.json({ status: s.status });
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});



app.post("/settingsload", (req, res) => {
    const { em, agent, key_serv } = req.body;
    loadSettingsData(key_serv, agent, getEmail(em)).then(d => {
        res.json({ status: "done", accdata: d.data })
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/settingsave", (req, res) => {
    const { em, agent, key_serv, usersetting } = req.body;
    saveSettingsData(key_serv, agent, getEmail(em), usersetting).then((s) => {
        if (s.status == "done") {
            res.json({ status: "saved" })
        } else {
            res.json(s)
        }
    }).catch(() => {
        res.json({ status: "invalid" });
    });

});

app.post("/getProjMembers", (req, res) => {
    const { em, agent, key_serv, project } = req.body;
    loadProjectMembers(key_serv, agent, getEmail(em), project).then(d => {
        res.json({ status: "done", team: d.data })
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/addNewProjMember", (req, res) => {
    const { em, agent, key_serv, member, role, approver, proj_id, projname, logo } = req.body;
    if (isValidEmail(member) && isValidEmail(approver)) {
        addMemberToProject(key_serv, agent, getEmail(em), member, role, approver, proj_id, projname, logo).then((ss) => {
            if (ss.status == "done") {
                res.json({ status: "added" });
            } else {
                res.json({ status: ss.status, msg: ss.msg });
            }
        }).catch(() => {
            res.json({ status: "invalid" });
        });
    } else {
        res.json({ status: "invalidEmail" });
    }

});

app.post("/addNewProject", (req, res) => {
    const { em, agent, key_serv, project, logo } = req.body;
    createNewProject(key_serv, agent, getEmail(em), project, logo).then(projid => {
        res.json({ status: "created", projid: projid })
    }).catch((s) => {
        if (s.state == "maxlimit") {
            res.json({ status: "limitreached", max: s.maxVal });
        } else if (s.state == "duplicateProject") {
            res.json({ status: "duplicate" });
        } else {
            res.json({ status: "invalid" });
        }

    });

});

app.delete("/removeMember", (req, res) => {
    const { em, agent, key_serv, project, member } = req.body;
    removeProjectMember(key_serv, agent, getEmail(em), project, member).then((delstatus) => {
        res.json({ status: delstatus })
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.delete("/removeTempProj", (req, res) => {
    const { em, agent, key_serv, proj } = req.body;
    removeProject(key_serv, agent, getEmail(em), proj).then(() => {
        res.json({ status: "removed" })
    })

});



app.post("/chartsload", (req, res) => {
    const { em, agent, key_serv, persTeam } = req.body;
    loadChartsData(key_serv, agent, getEmail(em), persTeam).then(c => {
        res.json({ status: "done", chartdata: c.chartdata })
    }).catch((err) => {
        if (err == "nochartdata") {
            res.json({ status: "nochart" })
        } else {
            res.json({ status: "invalid" });
        }
    })

});

app.post("/saveDefaultTheme", (req, res) => {
    const { em, agent, key_serv, theme } = req.body;
    saveDefaultTheme(key_serv, agent, getEmail(em), theme).then(() => {
        res.json({ status: "done" })
    }).catch((err) => {
        res.json({ status: "invalid" });
    })

});


app.post("/missingfeature", (req, res) => {
    let mailOptions = {
        from: KEYS_DATA.email,
        to: KEYS_DATA.notificationBox,
        subject: "Browser Missing features",
        html: `<h3>Features missing:</h3>

            <h4>${req.body.nofeature}</h4>
         -----------------------------------
            ${Buffer.from(req.body.agent, "base64").toString('ascii')}
        `
    };
    transporter.sendMail(mailOptions, (err, data) => {
        if (err) {
            res.json({ status: "??" });
        } else {
            res.json({ status: "OK" });
        }
    });

});

app.get("/about", (req, res) => {
    res.sendFile(__dirname + "/public/about.html");
});

app.get("/*", (req, res) => {
    res.redirect("https://" + req.headers.host + "/404.html");

});


http.listen(port, () => {
    console.log(`Server running at port ` + port);

});