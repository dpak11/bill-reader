let captureImg = document.getElementById('captureImg');
let fileImg = document.getElementById('fileImg');
let allBillsData = null;
let billsObjRef = {};
let selectedBillId = "";
let billMode = "save";
let currentUploadStatus = "";
let currentPage = "";

let billshomeBtn = document.getElementById("billshome");
let saveBillBtn = document.getElementById("savebill");
let deleteBillBtn = document.getElementById("deletebill");
let exitBillBtn = document.getElementById("exitbill");
let updateBillBtn = document.getElementById("updatebill");
let logOutBtn = document.getElementById("logout");




captureImg.addEventListener('change', () => {
    if (currentUploadStatus == "progress") {
        alert("Please wait for your previous Bill receipt to get processed.");
    } else if (currentUploadStatus == "unsaved") {
        alert("You have not saved the current Bill Receipt");
    } else {
        imageProcess(captureImg.files[0]);
    }


});

fileImg.addEventListener('change', () => {
    if (currentUploadStatus == "progress") {
        alert("Please wait for your previous Bill receipt to get processed.");
    } else if (currentUploadStatus == "unsaved") {
        alert("You have not saved the current Bill Receipt");
    } else {
        imageProcess(fileImg.files[0]);
    }

});



function imageProcess(imgfile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let imgsize = imgfile.size / 1024 / 1024;
        if (imgsize > 2) {
            currentUploadStatus = "";
            alert("File size is too Large.\nYour Bill Receipt must be less than 2 MB");
            return;
        }
        currentUploadStatus = "progress";
        let img = document.querySelector('.previewimg img');
        document.querySelector('.lds-roller').classList.remove("hide");
        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64            
            img.src = srcData;
            console.log("Init processing....\n" + srcData);
            document.querySelector('.lds-roller').classList.remove("hide");
            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ img: srcData, em: atob(sessionStorage.getItem("em")) }) })
                .then(data => data.json())
                .then(function(json) {
                    imageProcessDone(json.status);
                }).catch(function(s) {
                    imageProcessDone({});
                    alert("Problem reading your Receipt data.\nThis may be due to unsupported camera settings, or unexpected image format");
                });
        }
        fileReader.readAsDataURL(imgfile);

    } else if (imgfile.type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (imgfile.type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

}

function imageProcessDone(imgdata) {
    document.querySelector(".lds-roller").classList.add("hide");
    document.getElementById("billThumbnails").classList.add("hide");
    exitBillBtn.classList.remove("hide");
    deleteBillBtn.classList.add("hide");
    saveBillBtn.classList.remove("hide");
    updateBillBtn.classList.add("hide");
    displayBillingTable(imgdata);
    currentUploadStatus = "unsaved";
    billMode = "save";
}

function displayBillingTable(data) {
    document.querySelector('.previewimg').classList.remove("hide");
    document.getElementById("billTable").classList.remove("hide");
    document.getElementById("date_field").value = data.date || "";
    document.getElementById("merchant_field").value = data.title || "";
    document.getElementById("amount_field").value = data.total || "";
    document.getElementById("descr_field").value = data.descr || "";
    document.getElementById("billtype").value = data.type || "";

}

function displayBillThumbnails() {
    let thumbnails = document.getElementById("billThumbnails");
    thumbnails.classList.remove("hide");
    thumbnails.innerHTML = "";
    allBillsData.user_bills.forEach(function(bill) {
        const key = { cli: sessionStorage.getItem("ckey"), serv: sessionStorage.getItem("skey") };
        let billImg = decryptImg(bill.img, key);
        let billData = decryptData(bill.data, key);
        let typeImg = "images/" + billData.type + ".png";
        let thumbs = `<div class="amount-thumb">&#8377;${billData.total}</div>
            <div class="thumb-img">
                <img src="${billImg}">                
            </div> 
            <div class="thumb-title-bill">${billData.title}</div>
            <div class="thumb-type-bill"><img src="${typeImg}"></div>
            <div class="thumb-date-bill">${billData.date}</div>
            `;
        let div = document.createElement("div");
        div.className = "thumbnail";
        div.setAttribute("id", "thumb_" + bill.id);
        div.innerHTML = thumbs;
        div.setAttribute("data-billvals", btoa(JSON.stringify(billData)));
        billsObjRef[bill.id] = billImg;
        thumbnails.appendChild(div);
        div.addEventListener("click", function(ev) {
            billMode = "update";
            document.getElementById("imageuploader").classList.add("hide");
            document.getElementById("billThumbnails").classList.add("hide");
            saveBillBtn.classList.add("hide");
            updateBillBtn.classList.remove("hide");
            exitBillBtn.classList.remove("hide");
            deleteBillBtn.classList.remove("hide");
            let values = ev.currentTarget.getAttribute("data-billvals");
            selectedBillId = ev.currentTarget.getAttribute("id").split("mb_")[1];
            console.log("Selected ID:" + selectedBillId);
            displayBillingTable(JSON.parse(atob(values)));
            document.querySelector('.previewimg img').setAttribute("src", billsObjRef[selectedBillId]);
        })
    });

}

function fetchBills() {
    let client = sessionStorage.getItem("ckey") || false;
    let serv = sessionStorage.getItem("skey") || false;
    let sessionemail = sessionStorage.getItem("em") || false;
    if (client && serv && sessionemail) {
        fetch("../loadBills/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv }) })
            .then(data => data.json())
            .then(function(res) {
                console.log("loaded1");
                if (res.status == "invalid") {
                    console.log("load.2");
                    sessionStorage.clear();
                    document.querySelector('.lds-roller').classList.add("hide");
                }
                if (res.status == "done") {
                    console.log(res.user_data);
                    document.querySelector('.lds-roller').classList.add("hide");
                    allBillsData = res.user_data;
                    displayBillThumbnails();

                }
            }).catch(function() {
                console.log("load failed");
                document.querySelector('.lds-roller').classList.add("hide");
            });
    }
}

function saveBill(bill, email, serv) {
    fetch("../saveBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(email), agent: btoa(navigator.userAgent), key_serv: serv, receipt: bill }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "duplicate_bill") {
                saveBillBtn.innerText = "Save";
                saveBillBtn.classList.remove("saving-state");
                exitBillBtn.classList.remove("hide");
                alert("Sorry, can not Save.\nA Similar Bill already exists");
            }
            if (res.status == "saved") {
                exitBillBtn.click();
                saveBillBtn.innerText = "Save";
                saveBillBtn.classList.remove("saving-state");
                exitBillBtn.classList.remove("hide");
                currentUploadStatus = "";
                location.reload();
            }
        }).catch(function() {
            document.querySelector('.lds-roller').classList.add("hide");
            saveBillBtn.innerText = "Save";
            saveBillBtn.classList.remove("saving-state");
            exitBillBtn.classList.remove("hide");
            alert("Opps! Server timed out");
        });
}

function updateBill() {
    const client = sessionStorage.getItem("ckey");
    const serv = sessionStorage.getItem("skey");
    const sessionemail = sessionStorage.getItem("em");
    const date = document.getElementById("date_field").value;
    const merchant = document.getElementById("merchant_field").value;
    const amt = document.getElementById("amount_field").value;
    const descr = document.getElementById("descr_field").value;
    const billType = document.getElementById("billtype").value;

    const billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    const encrypted = encryptData(billdata, { serv: serv, cli: client });
    fetch("../updateBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv, receiptid: selectedBillId, bdata: encrypted }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "updated") {
                updateBillBtn.innerText = "Update";
                updateBillBtn.classList.remove("saving-state");
                deleteBillBtn.classList.remove("hide");
                exitBillBtn.classList.remove("hide");
                location.reload();

            }
        }).catch(function() {
            updateBillBtn.innerText = "Update";
            updateBillBtn.classList.remove("saving-state");
            deleteBillBtn.classList.remove("hide");
            exitBillBtn.classList.remove("hide");
            alert("Opps! Server timed out");
        });

}

function deleteBill() {
    const client = sessionStorage.getItem("ckey");
    const serv = sessionStorage.getItem("skey");
    const sessionemail = sessionStorage.getItem("em");
    fetch("../deleteBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv, receiptid: selectedBillId }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "deleted") {
                deleteBillBtn.innerText = "Delete";
                deleteBillBtn.classList.remove("saving-state");
                exitBillBtn.classList.remove("hide");
                updateBillBtn.classList.remove("hide");
                location.reload();

            }
        }).catch(function() {
            deleteBillBtn.innerText = "Delete";
            deleteBillBtn.classList.remove("saving-state");
            exitBillBtn.classList.remove("hide");
            updateBillBtn.classList.remove("hide");
            alert("Opps! Server timed out");
        });

}



billshomeBtn.addEventListener("click", function() {
    if (currentPage !== "bills") {
        console.log("fetching..");
        fetchBills();
        currentPage = "bills";
        document.querySelector('.lds-roller').classList.remove("hide");
        billshomeBtn.classList.add("nav-selected");
    }

});

saveBillBtn.addEventListener("click", function() {
    const date = document.getElementById("date_field").value;
    const merchant = document.getElementById("merchant_field").value;
    const amt = document.getElementById("amount_field").value;
    const descr = document.getElementById("descr_field").value;
    const billType = document.getElementById("billtype").value;

    const billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    const client = sessionStorage.getItem("ckey") || "";
    const serv = sessionStorage.getItem("skey") || "";
    const sessEmail = sessionStorage.getItem("em") || "";
    const imgSrc = document.querySelector('.previewimg img').getAttribute("src");
    const billObj = {
        bill: encryptImg(imgSrc, { serv: serv, cli: client }),
        billFields: encryptData(billdata, { serv: serv, cli: client })
    }
    console.log(billObj);
    saveBillBtn.innerText = "Saving, please wait...";
    saveBillBtn.classList.add("saving-state");
    deleteBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
    saveBill(billObj, sessEmail, serv);
});


updateBillBtn.addEventListener("click", function() {
    updateBillBtn.innerText = "Updating, please wait...";
    updateBillBtn.classList.add("saving-state");
    deleteBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
    updateBill();
});

deleteBillBtn.addEventListener("click", function() {
    //if (billMode == "update") {
    deleteBillBtn.innerText = "Deleting...";
    deleteBillBtn.classList.add("saving-state");
    updateBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
    deleteBill();
    //}
});

exitBillBtn.addEventListener("click", function() {
    document.getElementById("billTable").classList.add("hide");
    document.getElementById("date_field").value = "";
    document.getElementById("merchant_field").value = "";
    document.getElementById("amount_field").value = "";
    document.querySelector('.previewimg img').setAttribute("src", "");
    document.querySelector('.lds-roller').classList.add("hide");
    document.querySelector('.previewimg').classList.add("hide");
    currentUploadStatus = "";
    if (billMode == "update") {
        document.getElementById("imageuploader").classList.remove("hide");
        document.getElementById("billThumbnails").classList.remove("hide");
        billMode = "save";
    }

});

logOutBtn.addEventListener("click", function() {
    sessionStorage.clear();
    location.replace("/")
});






// SETTINGS 


let settingsBtn = document.getElementById("settings");
let profileImgBtn = document.getElementById("profile_img_browse");
let savesettingsBtn = document.getElementById("savesettings");
let cancelsettingsBtn = document.getElementById("cancelsettings");
let userAccField = document.getElementById("user_account_field");
let userSettingLink = document.getElementById("user_setting_link");
let teamSettingLink = document.getElementById("team_setting_link");
let createNewTeamBtn = document.getElementById("createNewTeam");
let addNewMemberBtn = document.getElementById("addNewMember");
let isProfilePicModified = false;
let saveSettingEnabled = false;
let initAccountVals = { name: "", type: "" };

profileImgBtn.addEventListener('change', () => {
    attachProfileImage(profileImgBtn.files[0]);

});



function attachProfileImage(imgfile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let imgsize = imgfile.size / 1024 / 1024;
        if (imgsize > 1) {
            currentUploadStatus = "";
            alert("Your photo size must be less than 1 MB");
            return;
        }

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            isProfilePicModified = true;
            let srcData = fileLoadedEvent.target.result;
            document.getElementById("userprofilepic").src = srcData;
        }
        fileReader.readAsDataURL(imgfile);
    }
}


settingsBtn.addEventListener("click", function() {
    if (currentPage !== "settings") {
        currentPage = "settings";
        billshomeBtn.classList.remove("nav-selected");
        settingsBtn.classList.add("nav-selected");
        document.getElementById("settingsBlock").classList.remove("hide");
        savesettingsBtn.classList.add("hide");        
        document.querySelector('.settingloadstatus').classList.remove("hide");
        saveSettingEnabled = false;
        loadAccountSettings();
    }
});

savesettingsBtn.addEventListener("click", function() {
    if (!saveSettingEnabled) {
        return;
    }

    let prof_img = document.getElementById("userprofilepic").getAttribute("src");
    let disp_name = document.getElementById("displayname_field").value;
    let acc_type = document.getElementById("user_account_field").value;

    if (disp_name !== initAccountVals.name || acc_type !== initAccountVals.type || isProfilePicModified) {
        saveSettingEnabled = false;
        savesettingsBtn.innerText = "Saving...";
        savesettingsBtn.classList.add("saving-state");
        cancelsettingsBtn.classList.add("hide");

        let accountObj = {
            profile_img: prof_img,
            displayname: disp_name,
            account: acc_type
        }

        fetch("../settingsave/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey"), usersetting: btoa(JSON.stringify(accountObj)) }) })
            .then(data => data.json())
            .then(function(setting) {
                if (setting.status == "invalid") {
                    sessionStorage.clear();
                }
                if (setting.status == "saved") {
                    if (acc_type !== initAccountVals.type) {
                        setTimeout(function() {
                            localStorage.setItem("accountchange", acc_type);
                            location.reload();
                        }, 1000);
                    } else {
                        isProfilePicModified = false;
                        savesettingsBtn.innerText = "Save";
                        savesettingsBtn.classList.remove("saving-state");
                        cancelsettingsBtn.classList.remove("hide");
                        initAccountVals.name = disp_name;
                        initAccountVals.type = acc_type;
                        saveSettingEnabled = true;
                        cancelsettingsBtn.click();
                    }

                }

            }).catch(function(s) {
                saveSettingEnabled = true;
                savesettingsBtn.innerText = "Save";
                savesettingsBtn.classList.remove("saving-state");
            });
    } else {
        cancelsettingsBtn.click();
    }


});

function loadAccountSettings() {
    fetch("../settingsload/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey") }) })
        .then(data => data.json())
        .then(function(setting) {
            if (setting.status == "invalid") {
                sessionStorage.clear();
            }
            if (setting.status == "done") {
                let settingdata = JSON.parse(atob(setting.accdata));
                console.log(settingdata);
                document.querySelector('.settingloadstatus').classList.add("hide");
                initAccountVals.name = settingdata.user_name;
                initAccountVals.type = settingdata.user_default;
                if (settingdata.user_photo != "" && settingdata.user_photo.length > 100) {
                    document.getElementById("userprofilepic").setAttribute("src", settingdata.user_photo);
                }
                if (initAccountVals.type == "personal") {
                    document.querySelector(".user_role").classList.add("hide");
                }
                document.getElementById("user_account_field").value = initAccountVals.type;
                document.getElementById("displayname_field").value = initAccountVals.name;
                document.getElementById("userrole_field").value = settingdata.user_role;
                document.getElementById("myemail_field").value = settingdata.user_email;
                savesettingsBtn.classList.remove("hide");
                saveSettingEnabled = true;
            }

        }).catch(function(s) {
            document.querySelector('.settingloadstatus').classList.add("hide");
            alert("Opps! Server timed out");

        });

}

userAccField.addEventListener("change", function() {
    if (initAccountVals.type !== userAccField.value) {
        document.querySelector(".tip-info").classList.remove("hide");
        document.getElementById("active_account_txt").innerText = initAccountVals.type;
        document.getElementById("new_account_txt").innerText = userAccField.value;

    } else {
        document.querySelector(".tip-info").classList.add("hide");
    }
});

userSettingLink.addEventListener("click", function() {
    document.getElementById("teamSettingsPage").classList.add("hide");
    document.getElementById("userSettingsPage").classList.remove("hide");
});

teamSettingLink.addEventListener("click", function() {
    document.getElementById("userSettingsPage").classList.add("hide");
    document.getElementById("teamSettingsPage").classList.remove("hide");
});

createNewTeamBtn.addEventListener("click", function() {
    document.getElementById("createNewTeam").classList.add("hide");
    document.getElementById("teamDetailsSection").classList.remove("hide");
});

addNewMemberBtn.addEventListener("click", function() {    
    document.getElementById("addUserPanel").classList.remove("hide");
    let newMemberPanel = document.querySelector("#newMemberPanelBody .newuserGroup") || null;
    if(!newMemberPanel){
        document.getElementById("addUserPanel").appendChild(addNewMemberBtn);
        let rolesPara = document.querySelector("#addUserPanel p");
        document.getElementById("addUserPanel").appendChild(rolesPara);
    }
    let div = document.createElement("div");
    div.setAttribute("class","newuserGroup");
    div.innerHTML = `   
        <span><input type="text" placeholder="Member Email"></span>
        <span>
            <select>
                <option value="none">-Select Role-</option>
                <option value="member">Member</option>
                <option value="manager">Manager</option>
            </select>
        </span>
        <span>
            <select>
                <option value="none">-Select Approver-</option>
            </select>
        </span>`;
    document.getElementById("newMemberPanelBody").appendChild(div);

});

cancelsettingsBtn.addEventListener("click", function() {
    currentPage = "bills";
    document.getElementById("settingsBlock").classList.add("hide");
    settingsBtn.classList.remove("nav-selected");
    billshomeBtn.classList.add("nav-selected");
});




function initLoad() {
    billshomeBtn.click();
    let accountchangeUser = localStorage.getItem("accountchange") || "";
    if (accountchangeUser != "") {
        localStorage.clear();
        let atype = accountchangeUser == "team" ? "Business/Team Account" : "Personal Account";
        let logmsg = "You are now logged into your " + atype;
        alert(logmsg);
    }
}


let initAuthState = sessionStorage.getItem("initAuth") || "";
if (initAuthState == "") {
    user_validate().then(function(status) {
        if (status == "valid") {
            sessionStorage.setItem("initAuth", "done");
            initLoad();
        }
    }).catch(function() {
        sessionStorage.clear();
        location.replace("/")
    })
}
if (initAuthState == "done") {
    initLoad();
}