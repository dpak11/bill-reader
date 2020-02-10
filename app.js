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
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

mongoose.Promise = global.Promise;
const mongoURL = KEYS_DATA.mongodb;

let Users = null;
let Teams = null;
let Pagevisits = mongoose.model("Pagevisits", new mongoose.Schema({
    date: String
}));

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true }, function() {
    console.log("MongoDB connected");
    Users = mongoose.model("Users", new mongoose.Schema({
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
        bills: [{ billid: String, imgsrc: String, data: String, submitdate: String, status: String, logs: [] }]

    }));

}).catch((err) => {
    console.log("MongoDB error");
    console.log(err)
});





let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.in',
    port: 465,
    secure: true,
    auth: {
        user: KEYS_DATA.email,
        pass: KEYS_DATA.mailerPswd
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
    const users = new Users({
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
            bills: [{ billid: String, encr_img: String, data: String, submitdate: String }]
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
    let receiptTitle = sanitiser(datarray[0], false) + " " + sanitiser(datarray[1], false);
    let arr = datarray.join("-|||-").toLowerCase().split("-|||-");
    let dateStr = dateSearch(arr);
    let totalsList = arr.filter((txt) => {
        return (txt.includes("total") || txt.includes("amount") || txt.includes("amnt") || txt.includes("amt") || txt.includes("payable") || txt.includes("rate"));
    });

    let get_total = null;
    if (totalsList.length > 0) {
        let totals = extractTotalVal(totalsList, arr);
        get_total = (totals.found == "string") ? sanitiser(totals.value, true) : totals.value;
    }
    return { title: receiptTitle, total: get_total, date: dateStr };


}

function dateSearch(lines) {
    let pattern1 = new RegExp("([0-9]){1,2}/([0-9]){1,2}/([0-9]){2,4}");
    let pattern2 = new RegExp("([0-9]){1,2}-([0-9]){1,2}-([0-9]){2,4}");
    let pattern3 = new RegExp("([0-9]){1,2}[\.]([0-9]){1,2}[\.]([0-9]){2,4}");
    let pattern4 = new RegExp("([0-9]){1,2}-([a-z]){3}-([0-9]){2,4}");
    let pattern5 = new RegExp("([0-9]){1,2} ([a-z]){3}, ([0-9]){2,4}");
    let pattern6 = new RegExp("([0-9]){1,2}/([a-z]){3}/([0-9]){2,4}");
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
        },
        monthNum: function(m) {
            let month = "jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec";
            let mlist = month.split(",");
            return (mlist.indexOf(m) + 1);
        }
    };

    lines.forEach((line) => {
        let l1 = line.match(pattern1);
        let l2 = line.match(pattern2);
        let l3 = line.match(pattern3);
        let l4 = line.match(pattern4);
        let l5 = line.match(pattern5);
        let l6 = line.match(pattern6);
        if (l1 != null && l1.length > 1) {
            let m1 = monthCheck.vals(l1[0].split("/"));
            if (m1) { dates.push(m1) }
        }
        if (l2 != null && l2.length > 1) {
            let m2 = monthCheck.vals(l2[0].split("-"));
            if (m2) { dates.push(m2) }
        }
        if (l3 != null && l3.length > 1) {
            let m3 = monthCheck.vals(l3[0].split("."));
            if (m3) { dates.push(m3) }
        }
        if (l4 != null && l4.length > 1) {
            let dt = l4[0].split("-");
            dt[1] = monthCheck.monthNum(dt[1]);
            let m4 = monthCheck.vals(dt);
            if (m4) { dates.push(m4) }
        } //06 Jun, 2019
        if (l5 != null && l5.length > 1) {
            let dt1 = l5[0].split(","); //[06 Jun, 2019]
            let dt2 = dt1[0].split(" "); //[06,Jun]
            let dt = `${dt2[0]},${monthCheck.monthNum(dt2[1])},${dt1[1].trim()}`;
            let m5 = monthCheck.vals(dt.split(","));
            if (m5) { dates.push(m5) }
        }
        if (l6 != null && l6.length > 1) {
            let dt = l6[0].split("/");
            dt[1] = monthCheck.monthNum(dt[1]);
            let m6 = monthCheck.vals(dt);
            if (m6) { dates.push(m6) }
        }

    });
    return dates[0]
}

function extractTotalVal(totals, alltexts) {
    let totalValue = "";
    let subs = "";
    totals.forEach((_total) => {
        let total = _total.trim();
        if (total.indexOf("subtotal") >= 0) {
            subs = total.split("subtotal")[1];
        } else {
            if (total.indexOf("sub total") >= 0) {
                subs = total.split("sub total")[1];
            }
        }

        if (total.indexOf("total") >= 0) {
            totalValue = total.split("total")[1];
        }

        if (total.indexOf("amt") >= 0) {
            totalValue = total.split("amt")[1];
        }

        if (total.indexOf("amnt") >= 0) {
            totalValue = total.split("amnt")[1];
        }


        if (total.indexOf("rate") >= 0) {
            totalValue = total.split("rate")[1];
        }

        if (total.indexOf("amount") >= 0) {
            totalValue = total.split("amount")[1];
        }
        if (total.indexOf("payable") >= 0) {
            totalValue = total.split("payable")[1];
        }
        if (total.indexOf("total amount") >= 0) {
            totalValue = total.split("total amount")[1];
        }
        if (total.indexOf("payable amount") == 0) {
            totalValue = total.split("payable amount")[1];
        }
        if (total.indexOf("amount payable") >= 0) {
            totalValue = total.split("amount payable")[1];
        }
    });

    if (totalValue.indexOf(",") > 0) {
        totalValue = totalValue.split(",").join("");
    }

    if (totalValue == "" || totalValue.indexOf(":") >= 0 || isNaN(sanitiser(totalValue, true))) {
        let newlist = null;
        if (totalValue.indexOf(":") >= 0) {
            totalValue = totalValue.split(":")[1].trim();
            if (totalValue.indexOf(" ") > 0) {
                totalValue = totalValue.split(" ")[0];
            }
            if (!isNaN(totalValue) && totalValue != "") {
                return { found: "string", value: totalValue };
            } else if (isNaN(sanitiser(totalValue, true))) {
                if (subs.trim() != "") {
                    return { found: "string", value: subs };
                } else {
                    newlist = alltexts.filter(txt => !isNaN(txt.trim()));
                    newlist.sort((a, b) => { return b - a });
                    return { found: "list", value: newlist }
                }

            }
        }
        newlist = alltexts.filter(txt => !isNaN(txt.trim()));
        newlist.sort((a, b) => { return b - a });
        return { found: "list", value: newlist }


    }
    if (totalValue == "" && subs != "") {
        return { found: "string", value: subs };
    }
    return { found: "string", value: totalValue };
}

function sanitiser(str, isNumber) {
    let chars = isNumber ? "0123456789." : "0123456789qwertyuioplkjhgfdsazxcvbnm &QWERTYUIOPLKJHGFDSAZXCVBNM-";
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
    let activatedUser = await Users.find({ email: em, activation: "_ENABLED_" });
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
    let actCodeUser = await Users.findOne({ email: em, activation: code });
    if (!actCodeUser) { return new Promise((resolve, reject) => reject()) }
    actCodeUser.activation = "_ENABLED_";
    let savedActivation = await actCodeUser.save();
    if (savedActivation) { return Promise.resolve() }
    return new Promise((resolve, reject) => reject());
}

async function saveRegisterationDB(key, agent, email) {
    let userEmail = await Users.findOne({ email: email });
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
        let userAuthKey = await Users.findOne({ email: email, key: pskey });
        if (!userAuthKey) { return new Promise((resolve, rej) => rej()) }
        userAuthKey.lastlogin = getIndDate();
        userAuthKey.browser = agent;
        let userSave = await userAuthKey.save();
        if (userSave) { return Promise.resolve() }
        return new Promise((resolve, rej) => rej());

    } else {
        let autoUserAuth = await Users.findOne({ email: email, key: pskey, browser: agent });
        if (autoUserAuth) { return new Promise((resolve, rej) => resolve()) }
        return new Promise((resolve, rej) => rej());
    }

}

async function loadProjectMembers(pskey, agent, email, proj) {
    let getValidUser = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!getValidUser) { return new Promise((resolve, rej) => rej()) }
    let getProjects = await Teams.find({ teamid: proj });
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
    let getValidUser = await Users.findOne({ email: email, key: pskey, browser: agent });
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
        let myteam = await Teams.find({ user_email: getValidUser.email });
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
    let getValidUser = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!getValidUser) {
        return new Promise((resolve, rej) => rej());
    }
    let settings = JSON.parse(Buffer.from(acc_setting, "base64").toString('ascii'));
    getValidUser.photo = settings.profile_img;
    getValidUser.name = settings.displayname;
    getValidUser.default = settings.account;
    if (settings.isSwitchedProj == "yes") {
        let allpromises = [];
        let mydocs = await Teams.find({ user_email: email });
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
    let projEditedList = await Teams.find({ teamid: editedproj.projid });
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
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
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
        let onedoc = await Teams.findOne({ user_email: email, default: "yes" });
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
        let tdoc = await Teams.findOne({ user_email: email, default: "yes" });
        if (!tdoc) {
            return new Promise((resolve, rej) => rej("nochartdata"));
        }
        let project = tdoc.teamid;
        let myrole = tdoc.role;
        let tdoc1 = await Teams.find({ teamid: project });
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
    let userdoc = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (userdoc.default == "team" && userdoc.privilege == "all") {
        let doc1 = await Teams.find({ user_email: email, role: "admin" });
        if (doc1.length == maxProjLimit) {
            return new Promise((res, rej) => rej({ state: "maxlimit", maxVal: maxProjLimit }));
        }
        if (doc1.length < maxProjLimit) {
            let isDefault = (doc1 == null || doc1.length == 0) ? "yes" : "no";
            let onedoc = await Teams.find({ title: proj });
            if (onedoc.length == 0) {
                let projID = idRandomise("teamid");
                let date_now = getIndDate();
                let newproject = new Teams({
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
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
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
        let teamem1 = await Teams.findOne({ user_email: newMemberEmail, teamid: project });
        if (!teamem1) {
            return addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver).then(async () => {
                let teamem2 = await Teams.findOne({ user_email: approver, teamid: project });
                if (!teamem2) {
                    return addToTeam(project, logoimg, project_name, approver, "manager", email).then(() => Promise.resolve({ status: "done" }));
                } else if (teamem2.role == "member") {
                    return Teams.deleteOne({ user_email: newMemberEmail, teamid: project }).exec().then(() => {
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
                let team_appr = await Teams.findOne({ user_email: approver, teamid: project });
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
    let memdoc = await Users.findOne({ email: member, activation: "_ENABLED_" });
    if (!memdoc) {
        return Promise.resolve({ state: "nouser" });
    }
    return Promise.resolve({ state: "allowuser" });
}

async function addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver) {
    let state = await getDefaultTeam(newMemberEmail);
    let date_now = getIndDate();
    let newproject = new Teams({
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
    let listeam = await Teams.findOne({ user_email: user });
    if (!listeam) {
        return Promise.resolve({ default: "yes" });
    } else {
        return Promise.resolve({ default: "no" });
    }
}

async function setDefaultTeam(user) {
    let listeam = await Teams.find({ user_email: user });
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
    let doc = await Users.findOne({ email: email, key: pwdkey, browser: useragent });
    if (!doc) { return new Promise((resolve, rej) => rej()) }
    let teamdoc = await Teams.findOne({ user_email: member, teamid: project });
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

        let deleteProj = await Teams.deleteOne({ user_email: member, teamid: project });
        return setDefaultTeam(member).then(async () => {
            if (teamdoc.role == "manager") {
                // If manager is deleted, then assign admin as the default bill approver to replace this manager
                let promises = [];
                let tm = await Teams.find({ approver: member, teamid: project });
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
    return Teams.deleteOne({ teamid: project }).exec().then((del) => {
        return new Promise((resolve, rej) => resolve());
    }).catch(err => new Promise((resolve, rej) => rej()))

}

async function loadUserBills(pskey, agent, email, mode) {
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) { return new Promise((resolve, rej) => rej()) }
    let obj = {};
    obj.account = userDoc.default;
    obj.controls = userDoc.privilege;
    obj.defaultskin = userDoc.theme;
    obj.isGlobalAdmin = (userDoc.privilege == "all") ? "yes" : "no";
    if (userDoc.default == "personal") {
        obj.user_bills = userDoc.personal.bills.map((bill) => {
            return {
                img: bill.encr_img,
                data: bill.data,
                id: bill.billid,
                lastdate: bill.submitdate
            }
        });
        return Promise.resolve({ data: obj });

    } else {
        let teamdoc = await Teams.find({ user_email: email });
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
                    obj.user_bills = tdoc.bills.filter(b => (b.imgsrc != "")).map((bill) => {
                        return {
                            img: bill.imgsrc,
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
                let alldocs = await findInProjectID(obj.activeProjectID, obj.controls, email, obj.role);
                obj.allProjMembers = JSON.stringify(alldocs);
                return Promise.resolve({ data: obj });
            }
        }

    }
}

async function findInProjectID(id, controls, email, roles) {
    let teamdoc = await Teams.find({ teamid: id });
    let allProjMembers = [];
    teamdoc.forEach((doc) => {
        if (controls == "all") {
            if (doc.role !== "admin") {
                let teamdata = getTeamData(doc);
                teamdata.forEach(bills => {
                    allProjMembers.push(bills);
                });
            }

        } else if (roles == "manager") {
            if (doc.approver == email) {
                let teamdata = getTeamData(doc);
                teamdata.forEach(bills => {
                    allProjMembers.push(bills);
                });

            }
        } else if (doc.user_email == email) {
            let teamdata = getTeamData(doc);
            teamdata.forEach(bills => {
                allProjMembers.push(bills);
            });
        }

    });
    return new Promise((resolve, rej) => resolve(allProjMembers));
}

function getTeamData(team_doc) {
    let projUserbills = team_doc.bills.filter(b => (b.imgsrc != "")).map(bill => {
        return {
            img: bill.imgsrc,
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
    return projUserbills;
}


async function saveUserBill(pskey, agent, email, receipt) {
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    if (userDoc.default == "personal") {
        let docBills = userDoc.personal.bills;
        let isDuplicates = false;
        docBills.forEach((bill) => {
            let half1 = receipt.bill.substr(0, 2000);
            let half2 = bill.encr_img.substr(0, 2000);
            if (half1 == half2) {
                isDuplicates = true;
            }
        });
        if (!isDuplicates) {
            docBills.push({ billid: idRandomise("bill"), encr_img: receipt.bill, data: receipt.billFields, submitdate: getIndDate() });
            userDoc.personal.bills = docBills;
            return userDoc.save().then(() => Promise.resolve());
        } else {
            return new Promise((resolve, rej) => rej("duplicate"));
        }

    } else {
        let teamdoc = await Teams.find({ user_email: email });
        if (teamdoc.length == 0) {
            return new Promise((resolve, rej) => rej());
        }
        let promisecall = [];
        teamdoc.forEach((tdoc, i) => {
            if (tdoc.default == "yes") {
                let isDuplicates = false;
                tdoc.bills.forEach((bill) => {
                    let half1 = receipt.bill.substr(0, 2000);
                    let half2 = bill.imgsrc.substr(0, 2000);
                    if (half1 == half2) {
                        isDuplicates = true;
                    }
                });
                if (!isDuplicates) {
                    let submDate = getIndDate();
                    tdoc.lastlogin = submDate;
                    tdoc.bills.push({
                        billid: idRandomise("bill"),
                        imgsrc: receipt.bill,
                        data: receipt.billFields,
                        submitdate: submDate,
                        status: "pending",
                        logs: ["Bill Submitted on: " + submDate]
                    });
                    promisecall[i] = tdoc.save().then(() => Promise.resolve());
                } else {
                    promisecall[i] = new Promise((resolve, rej) => rej("duplicate"));
                }
            }
        });

        return Promise.all(promisecall).then(() => {
            return Promise.resolve();
        });

    }

}



async function deleteUserBill(pskey, agent, email, bill_id) {
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    } else if (userDoc.default == "personal") {
        let deletedBills = userDoc.personal.bills.filter(bill => (bill.billid != bill_id));
        userDoc.personal.bills = deletedBills;
        return userDoc.save().then(() => Promise.resolve())
    } else {
        let teamdoc = await Teams.findOne({ user_email: email, default: "yes" });
        if (!teamdoc) {
            return new Promise((resolve, rej) => rej());
        }
        let deletedBills = teamdoc.bills.filter(bill => (bill.billid != bill_id));
        teamdoc.bills = deletedBills;
        return teamdoc.save().then(() => Promise.resolve());
    }
}


async function updateUserBill(pskey, agent, email, bill_id, bill_data) {
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
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
        let teamdoc = await Teams.findOne({ user_email: email, default: "yes" });
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

async function approveRejectUserBill(pskey, agent, email, bill_id, proj, user, mode) {
    let userDoc = await Users.findOne({ email: email, key: pskey, browser: agent });
    if (!userDoc) {
        return new Promise((resolve, rej) => rej());
    }
    let team = await Teams.findOne({ user_email: user, teamid: proj });
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
    let notification = await sendBillStatusNotification(email, user, mode, team.title);
    console.log(notification);
    return Promise.resolve({ status: mode });

}

function sendBillStatusNotification(approver, member, billstatus, projName) {
    let mailOptions = {
        from: KEYS_DATA.email,
        to: member,
        subject: `Your Bill was ${billstatus}`,
        html: `
        <p>Your Bill was <b>${billstatus}</b> by ${approver}</p>
        <p>Project Name: ${projName}</p>
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
    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
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
        let pagevisit = new Pagevisits({
            date: getIndDate()
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

app.post("/emailreq", (req, res) => {
    let email = getEmail(req.body.email);
    let mode = req.body.mode;
    if (isValidEmail(email)) {
        emailDBcheck(email, mode).then(() => {
            if (mode == "register") {
                genActivationCode(email, res);
            } else {
                res.json({ status: "require_pswd", e_mail: email })
            }
        }).catch((s) => {
            if (s.error == "email") {
                if (mode == "register") {
                    res.json({ status: "email_exists" })
                } else {
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
    const { em, agent, key_serv, mode, ptype } = req.body;
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

app.post("/deleteBill", (req, res) => {
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
    const { em, agent, key_serv, billid, proj, user, mode } = req.body;
    approveRejectUserBill(key_serv, agent, getEmail(em), billid, proj, user, mode).then((s) => {
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

app.post("/removeMember", (req, res) => {
    const { em, agent, key_serv, project, member } = req.body;
    removeProjectMember(key_serv, agent, getEmail(em), project, member).then((delstatus) => {
        res.json({ status: delstatus })
    }).catch(() => {
        res.json({ status: "invalid" });
    })

});

app.post("/removeTempProj", (req, res) => {
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


/* -----------------------------------------------------------------------
 ---------------- (Not for Production deployment)  ----------------------- 
 ------------------------------------------------------------------------- 
*/

app.post("/listUsers", (req, res) => {
    if (req.body.pass == KEYS_DATA.allUsersPswd) {
        fetchAllUsers().then((alldocs) => {
            res.json({ status: "done", results: alldocs })
        }).catch((err) => {
            res.json({ status: "serverbusy" });
        });
    } else {
        res.json({ status: "invalid" });
    }

});


app.post("/adminRights", (req, res) => {
    if (req.body.pass == KEYS_DATA.allowAdminRights) {
        adminPrivilegeController(req.body.mail, res)
    } else {
        res.json({ status: "invalid" });
    }

});


async function fetchAllUsers() {
    let allUsers = await Users.find({});
    if (allUsers.length == 0) {
        return new Promise((resolve, rej) => rej());
    }

    let all_users = [];
    allUsers.forEach(d => {
        let listObj = {};
        listObj.addr = d.email;
        listObj.key = (d.activation == "_ENABLED_") ? "Activated" : d.activation;
        listObj.access = (d.privilege == "all") ? "admin" : "";
        listObj.agent = d.browser;
        listObj.firstdate = d.created;
        listObj.lastdate = d.lastlogin;
        listObj.billNum = d.personal.bills.length;
        all_users.push(listObj)
    });

    let allvisits = [];
    let visits = await Pagevisits.find({});
    if (visits.length > 0) {
        visits.forEach(vs => {
            allvisits.push({ date: vs.date });
        });
    }
    return Promise.resolve({ allusers: all_users, visits: allvisits });

}

function adminPrivilegeController(email, response) {
    let mailOptions = {
        from: KEYS_DATA.email,
        to: email,
        subject: "You now have Administrator rights",
        html: `<h3>Full Admin Rights</h3>
        <h4>Congrats! You now have Administrator rights to create multiple projects</h4>
        <p>Login to BillVault, go to control Panel > Project Settings, and create your own projects.</p>
        <p>Upload your Project Logo, assign managers and members to your projects.</p>

        <p>(If you have any queries/concerns/suggestions, please email to: <b>${KEYS_DATA.email}</b>)</p>
        <p>&nbsp;</p>

        <p>Sincerely,<br>
        BillVault (Admin)</p>
        `
    };
    Users.findOne({ email: email, activation: "_ENABLED_" }).exec().then((doc) => {
        doc.privilege = "all";
        doc.save().then(() => {
            transporter.sendMail(mailOptions, (err, data) => {
                if (err) {
                    response.json({ status: "mailfailed" });
                } else {
                    response.json({ status: "done" });
                }
            });
        }).catch(() => {
            response.json({ status: "updatefailed" })
        })

    });

}