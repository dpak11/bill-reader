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
app.use(bodyParser.json({ limit: '5mb' })); // support json encoded bodies
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
        privilege: "none",
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

function processBillText(datarray) {
    let receiptTitle = sanitiser(datarray[0], false) + " " + sanitiser(datarray[1], false);
    let arr = datarray.join("-|||-").toLowerCase().split("-|||-");
    let dateStr = dateSearch(arr);
    let totalsList = arr.filter(function(txt) {
        return (txt.includes("total") || txt.includes("amount") || txt.includes("amnt") || txt.includes("payable") || txt.includes("rate"));
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

    lines.forEach(function(line) {
        let l1 = line.match(pattern1);
        let l2 = line.match(pattern2);
        let l3 = line.match(pattern3);
        let l4 = line.match(pattern4);
        let l5 = line.match(pattern5);
        let l6 = line.match(pattern6);
        if (l1 != null && l1.length > 1) {
            console.log("1st type date");
            let m1 = monthCheck.vals(l1[0].split("/"));
            if (m1) { dates.push(m1) }
        }
        if (l2 != null && l2.length > 1) {
            console.log("2nd type date");
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
    totals.forEach(function(_total) {
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

        if (total.indexOf("rate") >= 0) {
            totalValue = total.split("rate")[1];
        }
        if (total.indexOf("amnt") >= 0) {
            totalValue = total.split("amnt")[1];
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
                    newlist.sort(function(a, b) { return b - a });
                    return { found: "list", value: newlist }
                }

            }
        }
        newlist = alltexts.filter(txt => !isNaN(txt.trim()));
        newlist.sort(function(a, b) { return b - a });
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
                user_email: doc.email
            };
            let objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
            if (doc.default == "team") {
                return Teams.find({ user_email: doc.email }).exec().then(myteam => {
                    if (myteam == null || myteam.length == 0) {
                        obj.teamlist = [];
                        objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
                        return new Promise((resolve, rej) => resolve({ data: objdata }));
                    } else {
                        let teams = myteam.map(tm => {
                            return {
                                id: tm.teamid,
                                projname: tm.title
                            }
                        });
                        obj.teamlist = teams;
                        objdata = Buffer.from(JSON.stringify(obj)).toString('base64');
                        return new Promise((resolve, rej) => resolve({ data: objdata }));
                    }
                });
            } else {
                return new Promise((resolve, rej) => resolve({ data: objdata }));
            }

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

            if (settings.isSwitchedProj == "yes") {
                let allpromises = [];

                return Teams.find({ user_email: email }).exec().then(mydocs => {
                    mydocs.map((mydoc, i) => {
                        if (mydoc.teamid == settings.newProjectID) {
                            mydoc.default = "yes";
                        } else {
                            mydoc.default = "no";
                        }

                        allpromises[i] = mydoc.save().then(() => new Promise((resolve, rej) => resolve()));
                    });

                    return Promise.all(allpromises).then(() => {
                        return doc.save().then(() => new Promise((resolve, rej) => resolve()))

                    });

                });
            } else {
                return doc.save().then(() => new Promise((resolve, rej) => resolve()))
            }
        }

    });
}

function loadChartsData(pskey, agent, email, perMode) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else if (doc.default == "personal") {
            let datas = [];
            doc.personal.bills.forEach(function(bill) {
                datas.push({ data: bill.data, date: bill.submitdate })
            });
            let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
            return new Promise((resolve, rej) => resolve({ chartdata: objdata }));
        } else if (perMode == "private") {
            return Teams.findOne({ user_email: email, default: "yes" }).exec().then(onedoc => {
                if (onedoc == null) {
                    return new Promise((resolve, rej) => rej("nochartdata"));
                } else {
                    let datas = [];
                    onedoc.bills.forEach(bill => {
                        if (bill.status == "approved") {
                            datas.push({ data: bill.data, date: bill.submitdate });
                        }
                    });
                    let objdata = Buffer.from(JSON.stringify(datas)).toString('base64');
                    return new Promise((resolve, rej) => resolve({ chartdata: objdata }));
                }
            });
        } else if (perMode == "team") {
            return Teams.findOne({ user_email: email, default: "yes" }).exec().then(tdoc => {
                if (tdoc == null) {
                    return new Promise((resolve, rej) => rej("nochartdata"));
                } else {
                    let project = tdoc.teamid;
                    let myrole = tdoc.role;
                    return Teams.find({ teamid: project }).exec().then(tdoc1 => {
                        if (tdoc1 == null || tdoc1.length == 0) {
                            return new Promise((resolve, rej) => rej("invalid"));
                        } else {
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
                            return new Promise((resolve, rej) => resolve({ chartdata: objdata }));

                        }
                    });

                }
            }).catch(err => {
                console.log(err)
            })
        }
    });

}

function createNewProject(pskey, agent, email, proj, logoimg) {
    let maxProjLimit = 5;
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(function(doc) {
        if (doc.default == "team" && doc.privilege == "all") {
            return Teams.find({ user_email: email, role: "admin" }).exec().then(doc1 => {
                if (doc1 == null || doc1.length < maxProjLimit) {
                    let isDefault = (doc1 == null || doc1.length == 0) ? "yes" : "no";
                    return Teams.find({ title: proj }).exec().then(onedoc => {
                        if (onedoc == null || onedoc.length == 0) {
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
                            return newproject.save().then(function() {
                                return new Promise((resolve, rej) => resolve(projID));
                            }).catch(function() {
                                return new Promise((res, rej) => rej());
                            })
                        } else {
                            return new Promise((res, rej) => rej({ state: "duplicateProject" }));
                        }
                    });

                } else if (doc1.length == maxProjLimit) {
                    return new Promise((res, rej) => rej({ state: "maxlimit", maxVal: maxProjLimit }));
                }
            });
        }
    });

}

function addMemberToProject(pskey, agent, email, newMemberEmail, memberRole, approver, project, project_name, logoimg) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(function(doc) {
        if (doc.default == "team" && doc.privilege == "all") {
            return teamMemberValidation(newMemberEmail).then(s1 => {
                let userState = s1.state;
                if (userState == "nouser") {
                    return new Promise((res, reject) => reject({ status: userState, msg: `${newMemberEmail} is not yet registered.` }));
                } else {
                    return teamMemberValidation(approver).then(s2 => {
                        if (s2.state == "nouser") {
                            return new Promise((res, reject) => reject({ status: s2.state, msg: `${approver} is not yet registered.` }));
                        } else {
                            return Teams.findOne({ user_email: newMemberEmail, teamid: project }).exec().then(teamem1 => {
                                if (teamem1 == null) {
                                    //if (userState != "admin") {
                                    return addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver).then(() => {

                                        return Teams.findOne({ user_email: approver, teamid: project }).exec().then(teamem2 => {
                                            if (teamem2 == null) {
                                                return addToTeam(project, logoimg, project_name, approver, "manager", email)
                                                    .then(() => new Promise((resolve, rej) => resolve()));
                                            } else if (teamem2.role == "member") {
                                                return Teams.deleteOne({ user_email: newMemberEmail, teamid: project }).exec().then((del) => {
                                                    return new Promise((res, reject) => reject({ status: "declineMemberRole", msg: `Already assigned Member(${approver}) can not be re-assigned "Manager" Role` }));
                                                });

                                            } else {
                                                teamem2.role = (teamem2.role == "admin") ? "admin" : "manager";
                                                return teamem2.save().then(() => new Promise((resolve, rej) => resolve()))

                                            }
                                        });
                                    });
                                    /*} else {
                                        return new Promise((res, reject) => reject({ status: "adminreject", msg: `Can not Add "${newMemberEmail}", who is an Admin to other project(s)` }))
                                    }*/

                                } else if (teamem1.role == "manager") {
                                    if (memberRole == "member") {
                                        return new Promise((res, reject) => reject({ status: "preassigned", msg: `Can not re-assign Manager "${newMemberEmail}" as a Member` }))
                                    } else {
                                        return Teams.findOne({ user_email: approver, teamid: project }).exec().then(tc => {
                                            if (tc == null) {
                                                return addToTeam(project, logoimg, project_name, approver, "manager", email)
                                                    .then(() => {
                                                        teamem1.approver = approver;
                                                        return teamem1.save().then(() => new Promise((resolve, rej) => resolve()))
                                                    });
                                            } else if (tc.role == "manager" || tc.role == "admin") {
                                                if (teamem1.approver == approver) {
                                                    return new Promise((res, reject) => reject({ status: "preassigned", msg: `Error: Duplicate Assignment` }))
                                                } else {
                                                    teamem1.approver = approver;
                                                    return teamem1.save().then(() => new Promise((resolve, rej) => resolve()))
                                                }
                                            } else {
                                                return new Promise((res, reject) => reject({ status: "preassigned", msg: `Can not re-assign Member "${approver}" as approver` }))
                                            }
                                        });
                                    }

                                } else {
                                    return new Promise((res, reject) => reject({ status: "preassigned", msg: `${newMemberEmail} is already assigned to this Project` }))
                                }
                            });
                        }
                    });
                }

            });
        }
    });
}

function teamMemberValidation(member) {
    return Users.findOne({ email: member, activation: "_ENABLED_" }).exec().then(function(memdoc) {
        if (memdoc == null) {
            return new Promise((resolve, rej) => resolve({ state: "nouser" }));
        }
        /*else if (memdoc.privilege == "all") {
                   return new Promise((resolve, rej) => resolve({ state: "admin" }));
               }*/
        else {
            return new Promise((resolve, rej) => resolve({ state: "allowuser" }));
        }
    });
}

function addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver) {
    return setasDefaultTeam(newMemberEmail).then((state) => {
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
        //bills: [{ billid: "", imgsrc: "", data: "", submitdate: "", status: "", logs: [] }]
        return newproject.save().then(function(data) {
            return new Promise((resolve, rej) => resolve());
        }).catch(function() {
            return new Promise((res, rej) => rej());
        });
    });

}

function setasDefaultTeam(user) {
    return Teams.findOne({ user_email: user }).exec().then(listeam => {
        if (listeam == null) {
            return new Promise((res, rej) => res({ default: "yes" }));
        } else {
            return new Promise((res, rej) => res({ default: "no" }));

        }
    })
}


function removeProject(pwdkey, useragent, email, project) {
    return Teams.deleteOne({ teamid: project }).exec().then((del) => {
        return new Promise((resolve, rej) => resolve());
    }).catch(err => new Promise((resolve, rej) => rej()))

}

function loadUserBills(pskey, agent, email, mode) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {

        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let obj = {};
            obj.account = doc.default;
            obj.controls = doc.privilege;
            obj.isGlobalAdmin = (doc.privilege == "all") ? "yes" : "no";
            if (doc.default == "personal") {
                obj.user_bills = doc.personal.bills.map(function(bill) {
                    return {
                        img: bill.encr_img,
                        data: bill.data,
                        id: bill.billid,
                        lastdate: bill.submitdate
                    }
                });
                return new Promise((resolve, rej) => resolve({ data: obj }));

            } else {
                return Teams.find({ user_email: email }).exec().then(teamdoc => {
                    if (teamdoc == null || teamdoc.length == 0) {
                        return new Promise((resolve, rej) => rej({ status: "notinteam", data: obj }));
                    } else {
                        obj.activeProjectID = "";
                        if (mode == "private") {
                            teamdoc.forEach(function(tdoc) {
                                if (tdoc.default == "yes") {
                                    obj.activeProjectID = tdoc.teamid;
                                    obj.logo = tdoc.logo;
                                    obj.projname = tdoc.title;
                                    obj.role = tdoc.role;
                                    obj.controls = (tdoc.role == "admin") ? "all" : "none";
                                    obj.user_bills = tdoc.bills.filter(b => (b.imgsrc != "")).map(function(bill) {
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
                            return new Promise((resolve, rej) => resolve({ data: obj }));
                        }

                        if (mode == "team") {
                            teamdoc.forEach(function(tdoc) {
                                if (tdoc.default == "yes") {
                                    obj.activeProjectID = tdoc.teamid;
                                    obj.role = tdoc.role;
                                    obj.logo = tdoc.logo;
                                    obj.projname = tdoc.title;
                                    obj.controls = (tdoc.role == "admin") ? "all" : "none";
                                }
                            });

                            if (obj.activeProjectID == "") {
                                return new Promise((resolve, rej) => resolve({ data: obj }));
                            } else {
                                return findInProjectID(obj.activeProjectID, obj.controls, email, obj.role).then(function(alldocs) {
                                    obj.allProjMembers = JSON.stringify(alldocs);
                                    return new Promise((resolve, rej) => resolve({ data: obj }));
                                }).catch(function() {
                                    return new Promise((res, rej) => rej());
                                })
                            }
                        }

                    }
                });
            }
        }
    });

}

function findInProjectID(id, controls, email, roles) {
    return Teams.find({ teamid: id }).exec().then(teamdoc => {
        let allProjMembers = [];
        teamdoc.forEach(function(doc) {
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

    });
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



function saveUserBill(pskey, agent, email, receipt) {

    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else if (doc.default == "personal") {
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

        } else {
            return Teams.find({ user_email: email }).exec().then(teamdoc => {
                let promisecall = [];
                if (teamdoc == null || teamdoc.length == 0) {
                    return new Promise((resolve, rej) => rej());
                } else {
                    teamdoc.forEach((tdoc, i) => {
                        if (tdoc.default == "yes") {
                            let isDuplicates = false;
                            tdoc.bills.forEach(function(bill) {
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
                                promisecall[i] = tdoc.save().then(() => new Promise((resolve, rej) => resolve()));

                            } else {
                                promisecall[i] = new Promise((resolve, rej) => rej("duplicate"));
                            }
                        }
                    });

                    return Promise.all(promisecall).then(() => {
                        return new Promise((resolve, rej) => resolve());
                    });

                }

            });
        }

    })
}


function deleteUserBill(pskey, agent, email, bill_id) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else if (doc.default == "personal") {
            let deletedBills = doc.personal.bills.filter(bill => (bill.billid != bill_id));
            doc.personal.bills = deletedBills;
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            }).catch(function() {
                return new Promise((resolve, rej) => rej());
            })
        } else {
            return Teams.findOne({ user_email: email, default: "yes" }).exec().then(teamdoc => {
                if (teamdoc == null) {
                    return new Promise((resolve, rej) => rej());
                } else {
                    let deletedBills = teamdoc.bills.filter(bill => (bill.billid != bill_id));
                    teamdoc.bills = deletedBills;
                    return teamdoc.save().then(() => new Promise((resolve, rej) => resolve()));
                }
            });
        }

    })
}


function updateUserBill(pskey, agent, email, bill_id, bill_data) {

    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else if (doc.default == "personal") {
            doc.personal.bills.map(bill => {
                if (bill.billid === bill_id) {
                    bill.data = bill_data;
                    bill.submitdate = getIndDate();
                }
            });
            return doc.save().then(function() {
                return new Promise((resolve, rej) => resolve());
            }).catch(function() {
                return new Promise((resolve, rej) => rej());
            })

        } else {
            return Teams.findOne({ user_email: email, default: "yes" }).exec().then(teamdoc => {
                let promisecall = [];
                if (teamdoc == null || teamdoc.length == 0) {
                    return new Promise((resolve, rej) => rej());
                } else {
                    
                    teamdoc.bills.map(bill => {
                        if (bill.billid === bill_id) {
                            let modDate = getIndDate();
                            bill.data = bill_data;
                            bill.submitdate = modDate;
                            bill.status = "pending";
                            bill.logs.push("Bill Updated on: " + modDate);
                        }
                    });
                    return teamdoc.save().then(() => new Promise((resolve, rej) => resolve()));
                }
            });
        }
    }).catch(function() {
        return new Promise((resolve, rej) => rej());
    })
}

function approveRejectUserBill(pskey, agent, email, bill_id, proj, user, mode) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            return Teams.findOne({ user_email: user, teamid: proj }).exec().then(team => {
                if (team == null) {
                    return new Promise((resolve, rej) => rej());
                } else {
                    team.bills.map(bill => {
                        if (bill.billid === bill_id) {
                            let logval = "Bill " + mode + " by " + doc.name + " (" + email + ") on: " + getIndDate();
                            bill.logs.push(logval);
                            bill.status = mode;
                        }
                    });
                    return team.save().then(() => new Promise((resolve, rej) => resolve({ status: mode })));
                }
            });
        }
    });
}

function rejectUserBill(pskey, agent, email, bill_id, proj, user) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            return Teams.findOne({ user_email: user, teamid: proj }).exec().then(team => {
                if (team == null) {
                    return new Promise((resolve, rej) => rej());
                } else {
                    team.bills.map(bill => {
                        if (bill.billid === bill_id) {
                            bill.logs.push("Bill Rejected by " + doc.name + " (" + email + ") on: " + getIndDate());
                            bill.status = "rejected";
                        }
                    });
                    return teamdoc.save().then(() => new Promise((resolve, rej) => resolve()));
                }
            });
        }
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
    activation_code_verify(email, code).then(function() {
        let key = generateEmailConstantKey(email);
        res.json({ status: "activation_verified", serv_em_key: key })
    }).catch(function() {
        res.json({ status: "code_invalid" })
    })

});
app.post("/login", (req, res) => {
    const email = getEmail(req.body.email);
    emailDBcheck(email, "login").then(function() {
        let key = generateEmailConstantKey(email);
        res.json({ status: "email_ok", serv_em_key: key })
    }).catch(function(s) {
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
    saveRegisterationDB(pwdkey, useragent, email).then(function() {
        res.json({ status: "registered" });
    }).catch(function() {
        res.json({ status: "server_error" });
    })


});

app.post("/checkloginkey", (req, res) => {
    const pwdkey = req.body.serv_copy;
    const useragent = req.body.agent;
    const email = getEmail(req.body.email);
    userAuthenticate(pwdkey, useragent, email, "login").then(function() {
        res.json({ status: "verified" });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/userAuth", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = getEmail(req.body.em);
    userAuthenticate(pwdkey, useragent, email, "auto").then(function() {
        res.json({ status: "verified" });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/loadBills", (req, res) => {
    const { em, agent, key_serv, mode, ptype } = req.body;
    loadUserBills(key_serv, agent, getEmail(em), ptype).then(d => {
        console.log("loaded bills");
        res.json({ status: "done", user_data: d.data });
    }).catch(function(s) {
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
    }).catch(function(s) {
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
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/updateBill", (req, res) => {
    const { em, agent, key_serv, receiptid, bdata } = req.body;
    updateUserBill(key_serv, agent, getEmail(em), receiptid, bdata).then(() => {
        res.json({ status: "updated" });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/approveRejectBill", (req, res) => {
    const { em, agent, key_serv, billid, proj, user, mode } = req.body;
    approveRejectUserBill(key_serv, agent, getEmail(em), billid, proj, user, mode).then((s) => {
        res.json({ status: s.status });
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/settingsload", (req, res) => {
    const { em, agent, key_serv } = req.body;
    loadSettingsData(key_serv, agent, getEmail(em)).then(d => {
        res.json({ status: "done", accdata: d.data })
    }).catch(function() {
        res.json({ status: "invalid" });
    })

});

app.post("/settingsave", (req, res) => {
    const { em, agent, key_serv, usersetting } = req.body;
    saveSettingsData(key_serv, agent, getEmail(em), usersetting).then(() => {
        res.json({ status: "saved" })
    }).catch(function() {
        res.json({ status: "invalid" });
    });

});

app.post("/addNewProjMember", (req, res) => {
    const { em, agent, key_serv, member, role, approver, proj_id, projname, logo } = req.body;
    if (isValidEmail(member) && isValidEmail(approver)) {
        addMemberToProject(key_serv, agent, getEmail(em), member, role, approver, proj_id, projname, logo).then(() => {
            res.json({ status: "added" });
        }).catch(function(s) {
            if (s.status) {
                res.json({ status: s.status, msg: s.msg });
            } else {
                res.json({ status: "invalid" });
            }

        });
    } else {
        res.json({ status: "invalidEmail" });
    }

});

app.post("/addNewProject", (req, res) => {
    const { em, agent, key_serv, project, logo } = req.body;
    createNewProject(key_serv, agent, getEmail(em), project, logo).then(projid => {
        res.json({ status: "created", projid: projid })
    }).catch(function(s) {
        if (s.state == "maxlimit") {
            res.json({ status: "limitreached", max: s.maxVal });
        } else if (s.state == "duplicateProject") {
            res.json({ status: "duplicate" });
        } else {
            res.json({ status: "invalid" });
        }

    });

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
    }).catch(function(err) {
        if(err == "nochartdata"){
            res.json({status:"nochart"})
        }else{
            res.json({ status: "invalid" });
        }
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
    transporter.sendMail(mailOptions, function(err, data) {
        if (err) {
            res.json({ status: "??" });
        } else {
            res.json({ status: "OK" });
        }
    });

});

app.get("/*", (req, res) => {
    res.redirect("https://" + req.headers.host + "/404.html");

});


http.listen(port, () => {
    console.log(`Server running at port ` + port);

});