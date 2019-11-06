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
    let arr = datarray.join("-|||||-").toLowerCase().split("-|||||-");
    let dateStr = dateSearch(arr);
    console.log(arr);
    arr = arr.filter(function(txt) {
        return (txt.includes("total") || txt.includes("amount") || txt.includes("amnt") || txt.includes("payable") || txt.includes("rate"));
    });

    return new Promise((resolve, reject) => {
        if (arr.length > 0) {
            let get_total = sanitiser(extractTotalVal(arr), true);
            resolve({ title: receiptTitle, total: get_total, date: dateStr });
        } else {
            reject("No Total Found")
        }

    });

}

function dateSearch(lines) {
    let pattern1 = new RegExp("([0-9]){1,2}/([0-9]){1,2}/([0-9]){2,4}");
    let pattern2 = new RegExp("([0-9]){1,2}-([0-9]){1,2}-([0-9]){2,4}");
    //let pattern3 = new RegExp("([0-9]){1,2}\.([0-9]){1,2}\.([0-9]){2,4}");
    let pattern4 = new RegExp("([0-9]){1,2}-([a-z]){3}-([0-9]){2,4}");
    let pattern5 = new RegExp("([0-9]){1,2} ([a-z]){3}, ([0-9]){2,4}");
    let dates = [];
    
    let monthCheck = {
        vals: function(v) {
            console.log(v);
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
       // let l3 = line.match(pattern3);
        let l4 = line.match(pattern4);
        let l5 = line.match(pattern5);
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
        /*if (l3 != null && l3.length > 1) {
            console.log("3rd type date");
            console.log(l3[0]);
            let m3 = monthCheck.vals(l3[0].split("."));
            if (m3) { dates.push(m3) }
        }*/
        if (l4 != null && l4.length > 1) {
            console.log("4th type date");
            let dt = l4[0].split("-");
            dt[1] = monthCheck.monthNum(dt[1]);
            let m4 = monthCheck.vals(dt);
            if (m4) { dates.push(m4) }
        } //06 Jun, 2019
        if (l5 != null && l5.length > 1) {
            console.log("5th type date");
            let dt1 = l5[0].split(","); //[06 Jun, 2019]
            let dt2 = dt[0].split(" "); //[06,Jun]
            let dt = `${dt2[0]},${dt2[1]},${dt1[1].trim()}`;
            dt[1] = monthCheck.monthNum(dt.split(","));
            let m5 = monthCheck.vals(dt);
            if (m5) { dates.push(m5) }
        }
    });
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
                total.indexOf("rate") >= 0 ? total.split("rate")[1] :
                (subs == "" && total.indexOf("total") >= 0) ? total.split("total")[1] : "";
        }
    });
    if (totalValue == "" || totalValue == ":" || totalValue == " :") {
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
                console.log("switch project saving...");

                let allpromises = [];

                return Teams.find({ user_email: email }).exec().then(mydocs => {
                    mydocs.map((mydoc, i) => {
                        console.log(i);
                        if (mydoc.teamid == settings.newProjectID) {
                            mydoc.default = "yes";
                        } else {
                            mydoc.default = "no";
                        }

                        allpromises[i] = mydoc.save().then(() => new Promise((resolve, rej) => resolve()));
                    });

                    return Promise.all(allpromises).then(() => {
                        console.log("resolved ALL");
                        return doc.save().then(() => new Promise((resolve, rej) => resolve()))

                    });

                });
            } else {
                return doc.save().then(() => new Promise((resolve, rej) => resolve()))
            }
        }

    });
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


function createNewProject(pskey, agent, email, proj, logoimg) {
    let maxProjLimit = 5;
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(function(doc) {
        if (doc.default == "team" && doc.privilege == "all") {
            return Teams.find({ user_email: email, role: "admin" }).exec().then(doc1 => {
                console.log("creating...1");
                if (doc1 == null || doc1.length < maxProjLimit) {
                    let isDefault = (doc1 == null || doc1.length == 0) ? "yes" : "no";
                    return Teams.find({ title: proj }).exec().then(onedoc => {
                        console.log("creating...2");
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
                            //bills: [{ billid: "", imgsrc: "", data: "", submitdate: "", status: "", logs: [] }]

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
                let adminUser = s1.state;
                if (s1.state == "nouser") {
                    return new Promise((res, reject) => reject({ status: s1.state, msg: `${newMemberEmail} is not yet registered.` }));
                } else {
                    return teamMemberValidation(approver).then(s2 => {
                        if (s2.state == "nouser") {
                            return new Promise((res, reject) => reject({ status: s2.state, msg: `${approver} is not yet registered.` }));
                        } else {
                            return Teams.findOne({ user_email: newMemberEmail, teamid: project }).exec().then(teamem1 => {
                                if (teamem1 == null) {
                                    if (adminUser != "admin") {
                                        return addToTeam(project, logoimg, project_name, newMemberEmail, memberRole, approver).then(() => {

                                            return Teams.findOne({ user_email: approver, teamid: project }).exec().then(teamem2 => {
                                                if (teamem2 == null) {
                                                    return addToTeam(project, logoimg, project_name, approver, "manager", email)
                                                        .then(() => new Promise((resolve, rej) => resolve()));
                                                } else if (teamem2.role == "member") {
                                                    return new Promise((res, reject) => reject({ status: "declineMemberRole", msg: `Already assigned Member(${approver}) can not be re-assigned "Manager" Role` }));
                                                } else {
                                                    teamem2.role = (teamem2.role == "admin") ? "admin" : "manager";
                                                    return teamem2.save().then(() => new Promise((resolve, rej) => resolve()))

                                                }
                                            });
                                        });
                                    } else {
                                        return new Promise((res, reject) => reject({ status: "adminreject", msg: `Can not Add "${newMemberEmail}", who is an Admin to other project(s)` }))
                                    }

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
        } else if (memdoc.privilege == "all") {
            return new Promise((resolve, rej) => resolve({ state: "admin" }));
        } else {
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
            console.log("First Team for:" + user);
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

function loadUserBills(pskey, agent, email, mode, projid) {
    return Users.findOne({ email: email, key: pskey, browser: agent }).exec().then(doc => {

        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let obj = {};
            obj.account = doc.default;
            obj.controls = doc.privilege;
            if (doc.default == "personal") {
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
                                            approver: tdoc.approver,
                                            useremail: tdoc.user_email
                                        }
                                    });
                                }
                            });
                            console.log("personal team bill");
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
                    console.log("admin's team member bills.." + doc.user_email + " / " + doc.bills.length);
                    let teamdata = getTeamData(doc);
                    teamdata.forEach(bills => {
                        allProjMembers.push(bills);
                    });
                }

            } else if (roles == "manager") {
                if (doc.approver == email) {
                    allProjMembers.concat(getTeamData(doc));
                }
            } else if (doc.user_email == email) {
                allProjMembers.concat(getTeamData(doc));
            }

        });
        console.log("concated bills size: " + allProjMembers.length);
        return new Promise((resolve, rej) => resolve(allProjMembers));

    });
}

function getTeamData(team_doc) {

    let projUserbills = team_doc.bills.filter(b => (b.imgsrc != "")).map(bill => {
        console.log(bill.billid);
        return {
            img: bill.imgsrc,
            data: bill.data,
            id: bill.billid,
            lastdate: bill.submitdate,
            status: bill.status,
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
            console.log("saving to team");
            return Teams.find({ user_email: email }).exec().then(teamdoc => {
                let promisecall = [];
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
                    console.log("All resolved!");
                    return new Promise((resolve, rej) => resolve());
                });

            });
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
        for (let j = 0; j < 20; j++) {
            rnd = `${rnd}${chars.substr(Math.floor(Math.random()*chars.length),1)}`;
        }
    }
    return rnd;
}




app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");

});
app.get("/home", (req, res) => {
    res.sendFile(__dirname + "/public/home.html");
});

app.get("/get-my-users", (req, res) => {
    res.sendFile(__dirname + "/public/myuserlists.html");
});


/*
app.post("/processimage", (req, res) => {
    console.log("Image processing...");

    scanBill(req.body.img).then(function(data) {
        console.log(data);
        res.json({ status: data });
    }).catch(function(err) {
        res.json({ status: err });
    });

});
*/
app.post("/processTextData", (req, res) => {
    console.log("Text processing...");

    processBillText(req.body.imgtext).then(function(data) {
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
    const mode = req.body.ptype;
    const projid = req.body.projid;
    loadUserBills(pwdkey, useragent, email, mode, projid).then(function(d) {
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
    //const projectid = req.body.proj;
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
    });

});

app.post("/addNewProjMember", (req, res) => {
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const newMemberEmail = req.body.member;
    const memberRole = req.body.role;
    const approver = req.body.approver;
    const project = req.body.proj_id;
    const projname = req.body.projname;
    const logo = req.body.logo;
    if (isValidEmail(newMemberEmail) && isValidEmail(approver)) {
        addMemberToProject(pwdkey, useragent, email, newMemberEmail, memberRole, approver, project, projname, logo).then(function() {
            res.json({ status: "added" });
        }).catch(function(s) {
            console.log("cannot add Member to proj");
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
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const project = req.body.project;
    const logo = req.body.logo;
    createNewProject(pwdkey, useragent, email, project, logo).then(function(projid) {
        res.json({ status: "created", projid: projid })
    }).catch(function(s) {
        console.log("cannot create project");
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
    const pwdkey = req.body.key_serv;
    const useragent = req.body.agent;
    const email = req.body.em.toLowerCase();
    const project = req.body.proj;
    removeProject(pwdkey, useragent, email, project).then(function() {
        console.log("deleted");
        res.json({ status: "removed" })
    })

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




/* -----------------------------------------------------------------------
 ---------------- (Not for Production deployment)  ----------------------- 
 ------------------------------------------------------------------------- 
*/



app.post("/listUsers", (req, res) => {
    if (req.body.pass == "V@ult-06-82") {
        fetchAllUsers().then(function(alldocs) {
            res.json({ status: "done", results: alldocs })
        }).catch(function() {
            console.log("cannot load users");
            res.json({ status: "serverbusy" });
        });
    } else {
        res.json({ status: "invalid" });
    }

});


app.post("/adminRights", (req, res) => {
    if (req.body.pass == "@dmin-06") {
        adminPrivilegeController(req.body.mail, res)
    } else {
        res.json({ status: "invalid" });
    }

});


function fetchAllUsers() {
    return Users.find({}).exec().then(doc => {
        if (doc == null) {
            return new Promise((resolve, rej) => rej());
        } else {
            let allusers = [];
            console.log("fetching...");
            doc.forEach(function(d) {
                console.log(d.privilege);
                let listObj = {};
                listObj.addr = d.email;
                listObj.key = (d.activation == "_ENABLED_") ? "Activated" : d.activation;
                listObj.access = (d.privilege == "all") ? "admin" : "";
                listObj.agent = d.browser;
                listObj.firstdate = d.created;
                listObj.lastdate = d.lastlogin;
                listObj.billNum = d.personal.bills.length;
                allusers.push(listObj)
            });

            return new Promise((resolve, rej) => resolve(allusers));

        }

    }).catch(function() {
        console.log("users find failed");
        return new Promise((resolve, rej) => rej());
    })

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
    Users.findOne({ email: email, activation: "_ENABLED_" }).exec().then(function(doc) {
        doc.privilege = "all";
        doc.save().then(function() {
            transporter.sendMail(mailOptions, function(err, data) {
                if (err) {
                    response.json({ status: "mailfailed" });
                } else {
                    response.json({ status: "done" });
                }
            });
        }).catch(function() {
            response.json({ status: "updatefailed" })
        })

    });

}