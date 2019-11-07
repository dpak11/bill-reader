let allBillsData = null;
let billsObjRef = {};
let selectedBillId = "";
let billMode = "save";
let currentUploadStatus = "";
let currentPage = "";
let userAcType = "";
let teamAcRights = "";
let remPreviousActiveTab = "";
let selectedProjectID = "";
let projectMemberRole = "";
let selectedProjectName = "";

let billshomeBtn = document.getElementById("billshome");
let saveBillBtn = document.getElementById("savebill");
let deleteBillBtn = document.getElementById("deletebill");
let exitBillBtn = document.getElementById("exitbill");
let updateBillBtn = document.getElementById("updatebill");
let captureImg = document.getElementById('captureImg');
let fileImg = document.getElementById('fileImg');
let header_layout = document.querySelector("header");
let preloader = document.querySelector(".lds-roller");
let headerLogo = document.querySelector("header img");



header_layout.addEventListener("click", function() {
    let containerdiv = document.querySelector(".container");
    if (containerdiv.getAttribute("class").includes("topfloater")) {
        containerdiv.classList.remove("topfloater")
    } else {
        containerdiv.classList.add("topfloater")
    }

});



billshomeBtn.addEventListener("click", function() {
    if (currentPage !== "bills") {
        console.log("fetching..");
        fetchBills();
        currentPage = "bills";
        document.querySelector("title").text = "Bill Vault";
        preloader.classList.remove("hide");
        billshomeBtn.classList.add("nav-selected");
        chartsBtn.classList.remove("nav-selected");
        settingsBtn.classList.remove("nav-selected");
        document.getElementById("settingsBlock").classList.add("hide");
        document.getElementById("chartsBlock").classList.add("hide");
        document.getElementById("billTable").classList.remove("transparent");
        document.querySelector(".prev-block").classList.remove("transparent");
        document.getElementById("billThumbnails").classList.remove("transparent");
    }

});


captureImg.addEventListener('change', () => {
    if (currentUploadStatus == "progress") {
        showAlertBox("Please wait for your previous Bill receipt to get processed.", "OK", null, false)
    } else if (currentUploadStatus == "unsaved") {
        showAlertBox("You have not saved the current Bill Receipt", "OK", null, false)
    } else {
        imageProcess(captureImg.files[0]);
    }


});

fileImg.addEventListener('change', () => {
    if (currentUploadStatus == "progress") {

        showAlertBox("Please wait for your previous Bill receipt to get processed.", "OK", null, false)
    } else if (currentUploadStatus == "unsaved") {

        showAlertBox("You have not saved the current Bill Receipt", "OK", null, false)
    } else {
        imageProcess(fileImg.files[0]);
    }

});


function imageProcess(imgfile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let imgsize = imgfile.size / 1024 / 1024;
        if (imgsize > 4) {
            currentUploadStatus = "";

            showAlertBox("File size is too Large.\nYour Bill Receipt must be less than 4 MB", "OK", null, false)
            return;
        }

        currentUploadStatus = "progress";

        preloader.classList.remove("hide");
        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64          
            document.querySelector('.previewimg img').src = srcData;
            console.log("Init processing....\n");
            getOrientation(imgfile, function(orient) {
                console.log("got orientation val:" + orient);
                let byteSize = (4 * srcData.length / 3) / 1024 / 1024;
                if (byteSize < 3 && orient <= 1) {
                    BillImgProcessing(srcData);
                } else {
                    resetOrientation(srcData, orient, function(newImgData) {
                        //document.querySelector('.previewimg img').src = newImgData;
                        BillImgProcessing(newImgData);

                    });
                }
            });

        }

        fileReader.readAsDataURL(imgfile);

    } else if (imgfile.type.indexOf("audio/") > -1) {
        alert("Expecting an Image file");
    } else if (imgfile.type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

}

function BillImgProcessing(imgdata) {
    let GCVRequest = {
        requests: [{
            image: {
                content: imgdata.split(',')[1]
            },
            features: [{ type: 'TEXT_DETECTION' }]
        }]
    };

    fetch("https://vision.googleapis.com/v1/images:annotate?key=AIzaSyC_hFS0j3giQJ-JsCAv1piBmYlsTdbHyMc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(GCVRequest) })
        .then(data => data.json())
        .then(function(json) {
            let imgTxtdata = json.responses[0].fullTextAnnotation.text.split("\n");
            fetch("../processTextData/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imgtext: imgTxtdata, em: atob(sessionStorage.getItem("em")) }) })
                .then(dat => dat.json())
                .then(txtjson => {
                    document.querySelector('.previewimg img').src = imgdata;
                    imageProcessDone(txtjson.status);
                }).catch(function(s) {
                    document.querySelector('.previewimg img').src = imgdata;
                    imageProcessDone({});
                });
        }).catch(function(err) {
            document.querySelector('.previewimg img').src = imgdata;
            imageProcessDone({});
            showAlertBox("Server Busy at the moment", "OK", null, false);
        })

}


function getOrientation(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {

        var view = new DataView(e.target.result);
        if (view.getUint16(0, false) != 0xFFD8) {
            return callback(-2);
        }
        var length = view.byteLength,
            offset = 2;
        while (offset < length) {
            if (view.getUint16(offset + 2, false) <= 8) return callback(-1);
            var marker = view.getUint16(offset, false);
            offset += 2;
            if (marker == 0xFFE1) {
                if (view.getUint32(offset += 2, false) != 0x45786966) {
                    return callback(-1);
                }

                var little = view.getUint16(offset += 6, false) == 0x4949;
                offset += view.getUint32(offset + 4, little);
                var tags = view.getUint16(offset, little);
                offset += 2;
                for (var i = 0; i < tags; i++) {
                    if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                        return callback(view.getUint16(offset + (i * 12) + 8, little));
                    }
                }
            } else if ((marker & 0xFF00) != 0xFF00) {
                break;
            } else {
                offset += view.getUint16(offset, false);
            }
        }
        return callback(-1);
    };
    reader.readAsArrayBuffer(file);
}


function resetOrientation(srcBase64, srcOrientation, callback) {
    console.log("reset orientation");
    let img = new Image();
    img.onload = function() {
        console.log("reset orientation img onload");
        let width = img.width,
            height = img.height,
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext("2d");

        // set proper canvas dimensions before transform & export
        if (4 < srcOrientation && srcOrientation < 9) {
            canvas.width = height;
            canvas.height = width;
        } else {
            canvas.width = width;
            canvas.height = height;
        }

        console.log("reset orientation img onload");

        // transform context before drawing image
        switch (srcOrientation) {
            case 2:
                ctx.transform(-1, 0, 0, 1, width, 0);
                break;
            case 3:
                ctx.transform(-1, 0, 0, -1, width, height);
                break;
            case 4:
                ctx.transform(1, 0, 0, -1, 0, height);
                break;
            case 5:
                ctx.transform(0, 1, 1, 0, 0, 0);
                break;
            case 6:
                ctx.transform(0, 1, -1, 0, height, 0);
                break;
            case 7:
                ctx.transform(0, -1, -1, 0, height, width);
                break;
            case 8:
                ctx.transform(0, -1, 1, 0, 0, width);
                break;
            default:
                break;
        }

        ctx.drawImage(img, 0, 0);
        callback(canvas.toDataURL("image/jpeg", 0.7));

    };
    img.src = srcBase64;
};



function imageProcessDone(imgdata) {
    preloader.classList.add("hide");
    document.getElementById("billThumbnails").classList.add("hide");
    exitBillBtn.classList.remove("hide");
    deleteBillBtn.classList.add("hide");
    saveBillBtn.classList.remove("hide");
    updateBillBtn.classList.add("hide");
    displayBillingTable(imgdata);
    currentUploadStatus = "unsaved";
    billMode = "save";
}

function detectDeviceCam(callback) {
    let md = navigator.mediaDevices;
    if (!md || !md.enumerateDevices) return callback(false);
    md.enumerateDevices().then(devices => {
        callback(devices.some(device => 'videoinput' === device.kind));
    })
}

function addCategorySelectOptions() {
    let categoriy_opts = [{
        text: "Transportation",
        val: "transport"
    }, {
        text: "Fuel",
        val: "fuel"
    }, {
        text: "Restaurant/Food",
        val: "food"
    }, {
        text: "Lodging",
        val: "lodging"
    }, {
        text: "Entertainment",
        val: "entertainment"
    }];

    if (userAcType == "personal") {
        categoriy_opts.push({ text: "LifeStyle (Clothing/Footwear)", val: "lifestyle" });
        categoriy_opts.push({ text: "Medical", val: "medical" });
    }
    categoriy_opts.push({ text: "Other expenses", val: "other" });

    let billType_sel = document.getElementById("billtype");
    billType_sel.innerHTML = "";
    categoriy_opts.forEach(function(opt) {
        let option = document.createElement("option");
        option.text = opt.text;
        option.value = opt.val;
        billType_sel.appendChild(option);
    });

}




function fetchBills() {
    let client = sessionStorage.getItem("ckey") || false;
    let serv = sessionStorage.getItem("skey") || false;
    let sessionemail = sessionStorage.getItem("em") || false;
    let type = sessionStorage.getItem("is_private_team") || "private";

    if (client && serv && sessionemail) {
        fetch("../loadBills/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv, ptype: type, projid: selectedProjectID }) })
            .then(data => data.json())
            .then(function(res) {
                console.log("loaded1");
                if (res.status == "invalid") {
                    console.log("invalid");
                    sessionStorage.clear();
                    preloader.classList.add("hide");
                }
                if (res.status == "notinteam") {
                    userAcType = res.user_data.account;
                    teamAcRights = res.user_data.controls;
                    showAlertBox("You are not in any Project", "OK", null, false);
                    preloader.classList.add("hide");
                }
                if (res.status == "done") {
                    detectDeviceCam(function(hascam) {
                        if (hascam) { document.getElementById("cameraDevice").classList.remove("hide") }
                    });

                    userAcType = res.user_data.account;
                    teamAcRights = res.user_data.controls;
                    if (userAcType == "team") {
                        selectedProjectID = res.user_data.activeProjectID || "";
                        projectMemberRole = res.user_data.role || "";
                        let header_logo_img = res.user_data.logo || "";
                        headerLogo.src = (header_logo_img == "") ? "images/logo-sq.png" : header_logo_img;
                        selectedProjectName = res.user_data.projname || "";
                        projectNameHead.innerHTML = "<b>Project:</b>&nbsp;" + selectedProjectName;
                        projectNameHead.style.display = "block";
                        document.getElementById("mybillORall").style.display = "block";
                        if (type == "team") {
                            myBill_allMembs.innerText = "Show My Bills Only";
                            allBillsData = JSON.parse(res.user_data.allProjMembers);
                        } else {
                            myBill_allMembs.innerText = "Show Project Members Bills";
                            allBillsData = res.user_data.user_bills;
                        }

                    } else {
                        allBillsData = res.user_data.user_bills;
                    }

                    addCategorySelectOptions();
                    displayBillThumbnails();
                    document.getElementById("imageuploader").classList.remove("hide");
                    preloader.classList.add("hide");

                }
            }).catch(function(e) {
                showAlertBox("Server Busy!", "OK", null, false);
                console.log(e);
                preloader.classList.add("hide");
            });
    }
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
    allBillsData.forEach(function(bill) {
        let billImg = "";
        let billData = "";
        let thumbnailAlign = "centered";
        let thumbnailStatus = "hide";
        let billstatus = "";
        if (userAcType == "personal") {
            const key = { cli: sessionStorage.getItem("ckey"), serv: sessionStorage.getItem("skey") };
            billImg = decryptImg(bill.img, key);
            billData = decryptData(bill.data, key);
        } else {
            billImg = atob(bill.img);
            billData = JSON.parse(atob(bill.data));
            thumbnailAlign = "spaced";
            thumbnailStatus = "";
            billstatus = "images/" + bill.status + ".png";
        }
        let typeImg = "images/" + billData.type + ".png";
        let submit_date = bill.lastdate.split(",")[0];

        let thumbs = `<div class="thumb-top-row ${thumbnailAlign}">
                         <div class="amount-thumb">&#8377;${billData.total}
                     </div>
                <div class="bill-status ${thumbnailStatus}"><img src="${billstatus}"></div>
            </div>
            <div class="thumb-img">
                <img src="${billImg}">                
            </div>
            <div>
                <div class="thumb-title-bill">${billData.title}</div>
                <div class="thumb-type-bill"><img src="${typeImg}"></div>
                <div class="thumb-date-submit">Submitted: ${submit_date}</div>
                <div class="thumb-date-bill">Bill Date: ${billData.date}</div>
            </div> `;
        let div = document.createElement("div");
        div.className = "thumbnail";
        div.setAttribute("id", "thumb_" + bill.id);
        div.innerHTML = thumbs;
        div.setAttribute("data-billvals", btoa(JSON.stringify(billData)));
        if (userAcType == "team") {
            div.setAttribute("data-billstatus", bill.status);
            div.setAttribute("data-billapprover", bill.approver);
        }
        billsObjRef[bill.id] = billImg;
        thumbnails.appendChild(div);
        div.addEventListener("click", function(ev) {
            billMode = "update";
            document.getElementById("imageuploader").classList.add("hide");
            document.getElementById("billThumbnails").classList.add("hide");
            saveBillBtn.classList.add("hide");
            exitBillBtn.classList.remove("hide");
            updateBillBtn.classList.remove("hide");
            deleteBillBtn.classList.remove("hide");
            let values = ev.currentTarget.getAttribute("data-billvals");
            selectedBillId = ev.currentTarget.getAttribute("id").split("mb_")[1];
            console.log("Selected ID:" + selectedBillId);
            displayBillingTable(JSON.parse(atob(values)));
            if (userAcType == "team") {
                let _status = ev.currentTarget.getAttribute("data-billstatus");
                let _approver = ev.currentTarget.getAttribute("data-billapprover");
                document.querySelector(".bill-status-approval").classList.add(_status);
                if (_status == "approved") {
                    updateBillBtn.classList.add("hide");
                    deleteBillBtn.classList.add("hide");
                    saveBillBtn.classList.add("hide");
                    resetTableFields("disable");

                }
                if (_status == "pending") {
                    _status = " is <b>pending approval</b> from ";
                } else {
                    _status = " was <b>" + _status + "</b> by ";
                }
                document.getElementById("billTable").classList.add("teamTable");
                document.querySelector(".bill-status-approval").classList.remove("hide");
                document.querySelector(".bill-status-approval").innerHTML = `This Bill${_status}<span>${_approver}</span>`;
            }
            document.querySelector('.previewimg img').setAttribute("src", billsObjRef[selectedBillId]);

        });
    });

}

function tidyAmount(amount) {
    let amt = Number(amount.trim());
    if (isNaN(amt) || amt == "") {
        return 0;
    }
    if (amt < 1 || amt > 9999999 || amt == "") {
        return 0;
    }
    return amt;
}

function resetTableFields(state) {
    let fields = ["merchant_field", "amount_field", "descr_field"];
    fields.forEach(function(field) {
        if (state == "disable") {
            document.getElementById(field).style.color = "#b29898";
            document.getElementById(field).setAttribute("readonly", true);
        } else {
            document.getElementById(field).style.color = "#000";
            document.getElementById(field).removeAttribute("readonly");
        }
    });
    if (state == "disable") {
        document.getElementById("billtype").style.color = "#b29898";
        document.getElementById("billtype").disabled = true;
    } else {
        document.getElementById("billtype").style.color = "#000";
        document.getElementById("billtype").disabled = false;
    }

}


function updateBill() {
    const client = sessionStorage.getItem("ckey");
    const serv = sessionStorage.getItem("skey");
    const sessionemail = sessionStorage.getItem("em");
    const date = document.getElementById("date_field").value;
    const merchant = document.getElementById("merchant_field").value;
    const descr = document.getElementById("descr_field").value;
    const billType = document.getElementById("billtype").value;
    const amt = tidyAmount(document.getElementById("amount_field").value);

    if (date == "" || merchant == "") {
        showAlertBox("Please fill in the fields", "OK", null, false);
        return;
    }

    const billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    let encodedBill = "";
    if (userAcType == "personal") {
        encodedBill = encryptData(billdata, { serv: serv, cli: client });
    } else {
        encodedBill = btoa(JSON.stringify(billdata));
    }
    fetch("../updateBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv, receiptid: selectedBillId, bdata: encodedBill }) })
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
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });

}

function deleteBill() {
    deleteBillBtn.innerText = "Deleting...";
    deleteBillBtn.classList.add("saving-state");
    updateBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
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
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);
        });

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
                showAlertBox("Sorry, can not Save.\nThis Bill already exists", "OK", null, false);
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
            preloader.classList.add("hide");
            saveBillBtn.innerText = "Save";
            saveBillBtn.classList.remove("saving-state");
            exitBillBtn.classList.remove("hide");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);
        });
}





saveBillBtn.addEventListener("click", function() {
    const date = document.getElementById("date_field").value;
    const merchant = document.getElementById("merchant_field").value;
    const descr = document.getElementById("descr_field").value;
    const billType = document.getElementById("billtype").value;
    const amt = tidyAmount(document.getElementById("amount_field").value);
    if (date == "" || merchant == "") {
        showAlertBox("Please fill in the fields", "OK", null, false);
        return;
    }
    const billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    const client = sessionStorage.getItem("ckey") || "";
    const serv = sessionStorage.getItem("skey") || "";
    const sessEmail = sessionStorage.getItem("em") || "";
    const imgSrc = document.querySelector('.previewimg img').getAttribute("src");
    let billObj = {};
    if (userAcType == "personal") {
        billObj.bill = encryptImg(imgSrc, { serv: serv, cli: client });
        billObj.billFields = encryptData(billdata, { serv: serv, cli: client });
    } else {
        billObj.bill = btoa(imgSrc);
        billObj.billFields = btoa(JSON.stringify(billdata));
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
    showAlertBox("Are you sure you want to Delete this Bill?", "Yes", "No", true, deleteBill, null, null, null);

});

exitBillBtn.addEventListener("click", function() {
    document.getElementById("billTable").classList.add("hide");
    document.getElementById("date_field").value = "";
    document.getElementById("merchant_field").value = "";
    document.getElementById("amount_field").value = "";
    document.querySelector('.previewimg img').setAttribute("src", "");
    document.querySelector('.previewimg').classList.add("hide");
    preloader.classList.add("hide");
    resetTableFields("");

    currentUploadStatus = "";
    if (billMode == "update") {
        document.getElementById("imageuploader").classList.remove("hide");
        document.getElementById("billThumbnails").classList.remove("hide");
        billMode = "save";
    }

});


//-------------------------------------------------------------------------

// SETTINGS 


let settingsBtn = document.getElementById("settings");
let profileImgBtn = document.getElementById("profile_img_browse");
let teamImgBtn = document.getElementById("team_img_browse");
let savesettingsBtn = document.getElementById("savesettings");
let cancelsettingsBtn = document.getElementById("cancelsettings");
let userAccField = document.getElementById("user_account_field");
let userSettingLink = document.getElementById("user_setting_link");
let teamSettingLink = document.getElementById("team_setting_link");
let createNewTeamBtn = document.getElementById("createNewTeam");
let addNewMemberProjBtn = document.getElementById("addNewMemberProj");
let projectsListBlock = document.getElementById("projectsList");
let myProjectSelect = document.getElementById("myProject_select");
let projectNameHead = document.getElementById("projectNameHead");
let myBill_allMembs = document.querySelector("#mybillORall p");
let enableAddNewMember = false;
let isProfilePicModified = false;
let saveSettingEnabled = false;
let initAccountVals = { name: "", type: "", projchange: false };



myBill_allMembs.addEventListener("click", function() {
    let pvt = sessionStorage.getItem("is_private_team");
    if (!pvt || pvt == "private") {
        sessionStorage.setItem("is_private_team", "team");
    } else {
        sessionStorage.setItem("is_private_team", "private");
    }
    location.reload();
});


settingsBtn.addEventListener("click", function() {
    if (currentPage !== "settings" && userAcType !== "") {
        remPreviousActiveTab = currentPage;
        currentPage = "settings";
        billshomeBtn.classList.remove("nav-selected");
        chartsBtn.classList.remove("nav-selected");
        settingsBtn.classList.add("nav-selected");
        document.getElementById("settingsBlock").classList.remove("hide");
        savesettingsBtn.classList.add("hide");
        teamSettingLink.classList.add("hide");
        document.querySelector('.settingloadstatus').classList.remove("hide");
        document.getElementById("billTable").classList.add("transparent");
        document.querySelector(".prev-block").classList.add("transparent");
        document.getElementById("billThumbnails").classList.add("transparent");
        document.getElementById("chartsBlock").classList.add("transparent");
        saveSettingEnabled = false;
        loadAccountSettings();
        document.querySelector("title").text = "Settings | Bill Vault";
    }
});



profileImgBtn.addEventListener('change', () => {
    attachProfileImage(profileImgBtn.files[0], "userimage");

});


teamImgBtn.addEventListener('change', () => {
    attachProfileImage(teamImgBtn.files[0], "logo");

});



function attachProfileImage(imgfile, logoprofile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let imgsize = imgfile.size / 1024 / 1024;
        if (imgsize > 1) {
            currentUploadStatus = "";
            if (logoprofile == "userimage") {
                showAlertBox("Your photo size must be less than 1 MB", "OK", null, false);
            } else {
                showAlertBox("Logo size must be less than 1 MB", "OK", null, false);
            }
            return;
        }
        let tempImg = null;
        let srcData = "";
        if (logoprofile == "logo") {
            tempImg = new Image();
            tempImg.onload = function() {
                console.log("width:" + tempImg.width + "/" + tempImg.naturalWidth);
                if (tempImg.width > 196 || tempImg.heigth > 100 || tempImg.width < 150) {
                    showAlertBox("Logo Dimension must be 196 X 100", "OK", null, false);
                } else {
                    document.getElementById("teamlogoImg").src = srcData;
                }
            }
        }

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            srcData = fileLoadedEvent.target.result;
            if (logoprofile == "userimage") {
                isProfilePicModified = true;
                document.getElementById("userprofilepic").src = srcData;
            } else {
                tempImg.src = srcData;
            }
        }
        fileReader.readAsDataURL(imgfile);
    }
}




savesettingsBtn.addEventListener("click", function() {

    if (!saveSettingEnabled) {
        return;
    }

    isTempProj = localStorage.getItem("tempProjID") || "";
    if(isTempProj != ""){
        showAlertBox(`You forgot to assign Team Members for the Project: ${document.getElementById("displayteamname").value}`, "OK", null, false);
        return;
    }

    let prof_img = document.getElementById("userprofilepic").getAttribute("src");
    let disp_name = document.getElementById("displayname_field").value;
    let acc_type = document.getElementById("user_account_field").value;


    if (disp_name !== initAccountVals.name || acc_type !== initAccountVals.type || isProfilePicModified || initAccountVals.projchange) {
        saveSettingEnabled = false;
        savesettingsBtn.innerText = "Saving...";
        savesettingsBtn.classList.add("saving-state");
        cancelsettingsBtn.classList.add("hide");

        let accountObj = {
            profile_img: prof_img,
            displayname: disp_name,
            account: acc_type,
            isSwitchedProj: "no"
        }

        if (initAccountVals.projchange) {
            accountObj.isSwitchedProj = "yes";
            accountObj.newProjectID = myProjectSelect.value;
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
                    } else if (initAccountVals.projchange) {
                        setTimeout(function() {
                            localStorage.setItem("projectchange", "yes");
                            location.reload();
                        }, 1000);
                    } else {
                        isProfilePicModified = false;
                        savesettingsBtn.innerText = "Save";
                        savesettingsBtn.classList.remove("saving-state");
                        cancelsettingsBtn.classList.remove("hide");
                        initAccountVals.name = disp_name;
                        initAccountVals.type = acc_type;
                        initAccountVals.projchange = false;
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
                if (initAccountVals.type == "team") {
                    if (settingdata.teamlist.length > 0) {
                        projectsListBlock.classList.remove("hide");
                        let options = ``;
                        settingdata.teamlist.forEach(tm => {
                            options = `${options} <option value="${tm.id}">${tm.projname}</option>`;
                        });
                        myProjectSelect.innerHTML = options;
                        setTimeout(() => {
                            myProjectSelect.value = selectedProjectID
                        }, 1000);
                        initAccountVals.projchange = false;
                    }
                    teamSettingLink.classList.remove("hide");
                    document.querySelector(".user_role").classList.remove("hide");
                    document.getElementById("userrole_field").value = projectMemberRole || "--";

                    if (teamAcRights == "none") {
                        if (projectMemberRole == "member") {
                            document.querySelector("#addUserPanel p").remove();
                        }
                        document.querySelector('.team-sub-setting').remove();
                        createNewTeamBtn.remove();
                    }

                } else {
                    document.getElementById("teamSettingsPage").remove();
                }

                document.getElementById("user_account_field").value = initAccountVals.type;
                document.getElementById("displayname_field").value = initAccountVals.name;
                document.getElementById("myemail_field").value = settingdata.user_email;
                savesettingsBtn.classList.remove("hide");
                saveSettingEnabled = true;
            }

        }).catch(function(s) {
            console.log(s);
            document.querySelector('.settingloadstatus').classList.add("hide");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });

}

function addMemberToProject(member, role, approver) {
    const refereshMemberFields = {
        currentReset: function(memberFieldReset) {
            addNewMemberProjBtn.innerText = "Add Member to Project";
            addNewMemberProjBtn.classList.remove("saving-state");
            addNewMemberProjBtn.classList.add("btn");
            enableAddNewMember = true;
            if (memberFieldReset) {
                member.removeAttribute("readonly");
                approver.removeAttribute("readonly");
                role.disabled = false;
                member.classList.remove("member-fields-disable");
                approver.classList.remove("member-fields-disable");
                role.classList.remove("member-fields-disable");
            }
        }
    };
    const new_projid = document.getElementById("teamSettingsPage").getAttribute("data-projectIDnew");
    const new_projname = document.getElementById("teamSettingsPage").getAttribute("data-projectNewName");
    let logosrc = document.getElementById("teamlogoImg").src;
    if (logosrc.includes("images/user.png")) {
        logosrc = "";
    }

    fetch("../addNewProjMember/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey"), member: member.value, role: role.value, approver: approver.value, proj_id: new_projid, projname: new_projname, logo: logosrc }) })
        .then(data => data.json())
        .then(function(projmem) {
            if (projmem.status == "invalid") {
                sessionStorage.clear();
            } else if (projmem.status == "invalidEmail") {
                showAlertBox(`You have entered Invalid Email`, "OK", null, false);
                refereshMemberFields.currentReset(true);
            } else if (projmem.status == "added") {
                newMemberInsertFields();
                refereshMemberFields.currentReset(false);
                localStorage.removeItem("tempProjID");
            } else if (projmem.status && projmem.msg) {
                refereshMemberFields.currentReset(true);
                showAlertBox(projmem.msg, "OK", null, false);
            }

        }).catch(function(s) {
            enableAddNewMember = true;
            addNewMemberProjBtn.innerText = "Add Member to Project";
            addNewMemberProjBtn.classList.remove("saving-state");
            addNewMemberProjBtn.classList.add("btn");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });
}

function createNewProject() {
    let proj = document.getElementById("displayteamname").value.trim();
    let allowed = "1234567890 mnbvcxzasdfghjklpoiuytrewq_QWERTYUIOPLKJHGFDSAZXCVBNM-";
    if (proj.length < 3) {
        showAlertBox("Project Name Invalid", "OK", null, false);
        enableAddNewMember = true;
        return false;
    }
    if (proj.length > 40) {
        showAlertBox("Project Name can not exceed 40 Characters", "OK", null, false);
        enableAddNewMember = true;
        return false;
    }

    for (let i = 0; i < proj.length; i++) {
        if (allowed.indexOf(proj.substr(i, 1)) == -1) {
            showAlertBox("Project Name Invalid", "OK", null, false);
            enableAddNewMember = true;
            return false;
        }
    }

    addNewMemberProjBtn.innerText = "Adding Project...";
    addNewMemberProjBtn.classList.add("saving-state");
    addNewMemberProjBtn.classList.remove("btn");
    document.getElementById("displayteamname").classList.add("member-fields-disable");
    document.getElementById("displayteamname").setAttribute("readonly", true);
    createNewProjectName(proj);

}

function createNewProjectName(projname) {
    let logosrc = document.getElementById("teamlogoImg").src;
    if (logosrc.includes("images/user.png")) {
        logosrc = "";
    }
    fetch("../addNewProject/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey"), project: projname, logo: logosrc }) })
        .then(data => data.json())
        .then(function(proj) {
            if (proj.status == "invalid") {
                sessionStorage.clear();
            }

            if (proj.status == "limitreached") {
                showAlertBox(`You have already reached Maximum limit of ${proj.max} Projects`, "OK", null, false);
                document.getElementById("teamDetailsSection").remove();
            }

            if (proj.status == "duplicate") {
                showAlertBox(`This Project Name is already taken. Please try a different Name`, "OK", null, false);
                document.getElementById("displayteamname").classList.remove("member-fields-disable");
                document.getElementById("displayteamname").removeAttribute("readonly");
            }

            if (proj.status == "created") {
                document.getElementById("teamSettingsPage").setAttribute("data-projectIDnew", proj.projid);
                document.getElementById("teamSettingsPage").setAttribute("data-projectNewName", projname);
                document.getElementById("addUserPanel").appendChild(addNewMemberProjBtn);
                document.getElementById("addUserPanel").classList.remove("hide");
                let rolesPara = document.querySelector("#addUserPanel p");
                document.getElementById("addUserPanel").appendChild(rolesPara);
                newMemberInsertFields();
                document.querySelector("#team_img_browse+label").remove();
                addNewMemberProjBtn.innerText = "Add Member to Project";
                addNewMemberProjBtn.classList.remove("saving-state");
                addNewMemberProjBtn.classList.add("btn");
                enableAddNewMember = true;
                localStorage.setItem("tempProjID", proj.projid);
            }

        }).catch(function(s) {
            enableAddNewMember = true;
            addNewMemberProjBtn.innerText = "Add Member to Project";
            addNewMemberProjBtn.classList.remove("saving-state");
            addNewMemberProjBtn.classList.add("btn");
            document.getElementById("displayteamname").classList.remove("member-fields-disable");
            document.getElementById("displayteamname").removeAttribute("readonly");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });
}



function newMemberInsertFields() {
    let div = document.createElement("div");
    div.setAttribute("class", "newuserGroup");
    div.innerHTML = `   
        <span><input class="member-email-field" type="text" placeholder="Member's Email"></span>
        <span>
            <select class="select-roles-control">
                <option value="none">-Select Role-</option>
                <option value="member">Member</option>
                <option value="manager">Manager</option>
            </select>
        </span>
        <span>
           <input type="text" class="approver-email-field" placeholder="Approver's Email">
        </span>`;
    document.getElementById("newMemberPanelBody").appendChild(div);

}


function removeTempProject(pID) {
    fetch("../removeTempProj/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey"), proj: pID }) })
        .then(data => data.json())
        .then(function(s) {            
            if(s.status == "removed"){
                localStorage.removeItem("tempProjID");
            }            
        });
}

userAccField.addEventListener("change", function() {
    if (initAccountVals.type !== userAccField.value) {
        document.querySelector(".tip-info").classList.remove("hide");
        document.getElementById("active_account_txt").innerText = initAccountVals.type;
        document.getElementById("new_account_txt").innerText = userAccField.value;
        if(userAccField.value == "team" && teamAcRights == "none"){
            showAlertBox("Business Account lets you create Multiple projects. You must have Full Membership to use Business Account. Please contact billvault.app@gmail.com for Full Membership", "OK", null, false);
        }
        
    } else {
        document.querySelector(".tip-info").classList.add("hide");
    }
});

myProjectSelect.addEventListener("change", function() {
    if (myProjectSelect.value != selectedProjectID) {
        initAccountVals.projchange = true;
    }
})

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
    enableAddNewMember = true;
});

addNewMemberProjBtn.addEventListener("click", function() {
    if (!enableAddNewMember) {
        return false;
    }
    enableAddNewMember = false;

    let newMemberPanel = document.querySelector("#newMemberPanelBody .newuserGroup") || null;
    if (!newMemberPanel && teamAcRights == "all") {
        createNewProject();
    } else {
        document.getElementById("addUserPanel").classList.remove("hide");
        let nodes = document.querySelectorAll(".newuserGroup");
        let lastGroup = nodes[nodes.length - 1];
        let memb_email = lastGroup.querySelector(".member-email-field");
        let memb_roles = lastGroup.querySelector(".select-roles-control");
        let appr_email = lastGroup.querySelector(".approver-email-field");

        if (memb_roles.value == "none") {
            showAlertBox("Please select a role", "OK", null, false);
            enableAddNewMember = true;
            return;
        }
        if (memb_email.value.trim() == "" || appr_email.value.trim() == "") {
            showAlertBox("Please enter email", "OK", null, false);
            enableAddNewMember = true;
            return;
        }
        memb_email.setAttribute("readonly", true);
        appr_email.setAttribute("readonly", true);
        memb_roles.disabled = true;
        memb_email.classList.add("member-fields-disable");
        appr_email.classList.add("member-fields-disable");
        memb_roles.classList.add("member-fields-disable");
        addNewMemberProjBtn.innerText = "Adding...";
        addNewMemberProjBtn.classList.add("saving-state");
        addNewMemberProjBtn.classList.remove("btn");
        addMemberToProject(memb_email, memb_roles, appr_email);
    }

});


cancelsettingsBtn.addEventListener("click", function() {
    document.getElementById("settingsBlock").classList.add("hide");
    document.getElementById("billTable").classList.remove("transparent");
    document.querySelector(".prev-block").classList.remove("transparent");
    document.getElementById("billThumbnails").classList.remove("transparent");
    document.getElementById("chartsBlock").classList.remove("transparent");
    settingsBtn.classList.remove("nav-selected");
    if (remPreviousActiveTab == "bills") {
        billshomeBtn.classList.add("nav-selected");
        document.querySelector("title").text = "Bill Vault";
    }
    if (remPreviousActiveTab == "charts") {
        chartsBtn.classList.add("nav-selected");
        document.querySelector("title").text = "Chart | Bill Vault";
    }
    currentPage = remPreviousActiveTab;

});



//-------------------------------------------------------------------------

// Charts


/*let piechartdata = [
    ['Task', 'Hours per Day'],
    ['Fuel', 250],
    ['Entertainment', 102],
    ['Food', 20],
    ['Lodging', 550],
    ['Travel', 140]
];
let barchartdata = [
    ['Category', 'Fuel', 'Entertainment', 'Food', 'Lodging',
        'Travel', 'Others', { role: 'annotation' }
    ],
    ['Oct', 250, 424, 120, 100, 50, 280, ''],
    ['Sep', 280, 500, 500, 30, 450, 100, ''],
    ['Aug', 28, 19, 29, 30, 12, 550, '']
];
*/


let chartsBtn = document.getElementById("charts");
let chartsFilterSelect = document.getElementById("chartdaysFilter");
let all_chart_data = [];

function drawBillsChart(chartElem, chartdata, title, stacked) {
    let charts = {
        drawChart: function() {
            let options = {};
            let elem = document.getElementById(chartElem);
            if (chartElem == "piechart") {
                options = {
                    title: title,
                    is3D: true
                };
            } else {
                options = {
                    legend: { position: 'top', maxLines: 3 },
                    bar: { groupWidth: '75%' },
                    isStacked: stacked,
                    title: title
                };
            }
            let arraydata = google.visualization.arrayToDataTable(chartdata);
            let chartPlot = null;
            if (chartElem == "piechart") {
                chartPlot = new google.visualization.PieChart(elem);
            } else {
                chartPlot = new google.visualization.BarChart(elem);
            }
            chartPlot.draw(arraydata, options);
        }
    }
    let get_width = document.getElementById("chartsBlock").offsetWidth;
    console.log(get_width);
    let setwidth = get_width > 500 ? Math.round(get_width / 2) + 200 : get_width;
    document.getElementById(chartElem).style.width = `${setwidth}px`;
    document.getElementById(chartElem).style.height = `${setwidth-100}px`;
    google.charts.load("current", { packages: ["corechart"] });
    google.charts.setOnLoadCallback(charts.drawChart);

}



chartsFilterSelect.addEventListener("change", function() {
    filterChart(Number(chartsFilterSelect.value));
});


chartsBtn.addEventListener("click", function() {
    if (currentPage !== "charts" && userAcType !== "") {
        currentPage = "charts";
        billshomeBtn.classList.remove("nav-selected");
        settingsBtn.classList.remove("nav-selected");
        chartsBtn.classList.add("nav-selected");
        document.getElementById("settingsBlock").classList.add("hide");
        document.getElementById("imageuploader").classList.add("hide");
        document.getElementById("billTable").classList.add("hide");
        document.querySelector(".previewimg").classList.add("hide");
        document.getElementById("billThumbnails").classList.add("hide");
        document.getElementById("chartsBlock").classList.add("hide");
        //document.getElementById("chartdaysFilter").classList.add("hide");        
        document.getElementById("chartsBlock").classList.remove("transparent");
        preloader.classList.remove("hide");
        loadCharts("personal");
        document.querySelector("title").text = "Chart | Bill Vault";

    }
});


function loadCharts(type) {
    fetch("../chartsload/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionStorage.getItem("em")), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey"), persTeam: type }) })
        .then(data => data.json())
        .then(function(c) {
            if (c.status == "done") {
                preloader.classList.add("hide");
                //document.getElementById("chartdaysFilter").classList.remove("hide");
                document.getElementById("chartsBlock").classList.remove("hide");
                const bData = JSON.parse(atob(c.chartdata));
                console.log(bData);
                const key = { cli: sessionStorage.getItem("ckey"), serv: sessionStorage.getItem("skey") };
                all_chart_data = [];
                bData.forEach(function(d) {
                    let billData = null;
                    if (userAcType == "personal") {
                        billData = decryptData(d.data, key);
                    } else {
                        billData = JSON.parse(atob(d.data));
                    }
                    let thedate = d.date.split(",")[0];
                    let c_obj = {
                        total: parseInt(billData.total),
                        category: billData.type,
                        date: thedate,
                        datesequence: thedate.split("/").reverse().join("")
                    };
                    all_chart_data.push(c_obj);

                });
                //all_chart_data = JSON.parse(atob(rawChartData));
                all_chart_data.sort(function(a, b) {
                    return a.datesequence > b.datesequence ? -1 : (a.datesequence < b.datesequence ? 1 : 0);
                });
                filterChart(7);
            }

        }).catch(function() {
            console.log("chat data fail load")
        })
}



function filterChart(days) {
    console.log(all_chart_data);
    let pieChartList = all_chart_data.slice(0);
    let markerPoint = 0;
    let todate1 = pieChartList[0].date;
    let fromdate1 = "";
    pieChartList = pieChartList.filter(function(dx, p) {
        let tot_days = dateDifference(pieChartList[0].date, dx.date);
        if (tot_days <= days) {
            markerPoint = p;
            fromdate1 = dx.date;
        }
        return tot_days <= days;
    });
    let categories_pie = calculatedTotals(pieChartList);
    console.log(fromdate1, todate1, markerPoint);
    console.log(pieChartList);
    console.log(categories_pie);
    console.log("-------------------------------");

    let barChartList1 = null;
    let barChartList1Filter = null;
    let categories_bar1 = null;
    let fromdate2 = "";
    let todate2 = "";
    if (days >= 60) {
        barChartList1 = all_chart_data.slice(0);
        barChartList1 = barChartList1.splice(markerPoint + 1);
        console.log("MarkerPoint:" + (markerPoint + 1));
        console.log(barChartList1);
        todate2 = barChartList1.length > 0 ? barChartList1[0].date : "";
        barChartList1Filter = barChartList1.filter(function(dx, p) {
            let tot_days = dateDifference(barChartList1[0].date, dx.date);
            if (tot_days <= 30) {
                markerPoint = p;
                fromdate2 = dx.date;
            }
            return tot_days <= days;
        });
        categories_bar1 = calculatedTotals(barChartList1Filter);
        console.log(fromdate2, todate2);
        console.log(barChartList1Filter);
        console.log(categories_bar1);
        console.log("-------------------------------");
    }


    let barChartList2Filter = null;
    let categories_bar2 = null;
    let fromdate3 = "";
    let todate3 = "";
    if (days == 90) {
        barChartList2Filter = barChartList1.splice(markerPoint + 1);
        todate3 = barChartList2Filter.length > 0 ? barChartList2Filter[0].date : "";
        console.log("MarkerPoint:" + (markerPoint + 1));
        console.log(barChartList2Filter);
        barChartList2Filter = barChartList2Filter.filter(function(dx, p) {
            let tot_days = dateDifference(barChartList2Filter[0].date, dx.date);
            if (tot_days <= 30) {
                fromdate3 = dx.date;
            }
            return tot_days <= 30;
        });
        categories_bar2 = calculatedTotals(barChartList2Filter);
        console.log(fromdate3, todate3);
        console.log(barChartList2Filter);
        console.log(categories_bar2);
        console.log("-------------------------------");
    }


    let piechartdata = [
        ['Category', 'Total Amount(Rs)'],
        ['Fuel', categories_pie.fuel],
        ['Entertainment', categories_pie.entertainment],
        ['Food/Restaurant', categories_pie.food],
        ['Lodging', categories_pie.lodging],
        ['Transportation', categories_pie.transport]
    ];

    if (userAcType == "personal") {
        piechartdata.push(['LifeStyle', categories_pie.lifestyle]);
        piechartdata.push(['Medical', categories_pie.medical]);
    }
    piechartdata.push(['Others', categories_pie.other]);


    let from_to = showDayMonth(fromdate1) + "-\n" + showDayMonth(todate1);
    let barchartdata = [
        ['Category', 'Fuel', 'Entertainment', 'Food/Restaurant', 'Lodging',
            'Transportation', 'Others', { role: 'annotation' }
        ],
        [from_to, categories_pie.fuel, categories_pie.entertainment, categories_pie.food, categories_pie.lodging, categories_pie.transport, categories_pie.other, '']
    ];
    if (userAcType == "personal") {
        barchartdata = [
            ['Category', 'Fuel', 'Entertainment', 'Food/Restaurant', 'Lodging',
                'Transportation', 'LifeStyle', 'Medical', 'Others', { role: 'annotation' }
            ],
            [from_to, categories_pie.fuel, categories_pie.entertainment, categories_pie.food, categories_pie.lodging, categories_pie.transport, categories_pie.lifestyle, categories_pie.medical, categories_pie.other, '']
        ];

    }
    if (categories_bar1) {
        from_to = showDayMonth(fromdate2) + "-\n" + showDayMonth(todate2);
        if (userAcType == "personal") {
            barchartdata.push([from_to, categories_bar1.fuel, categories_bar1.entertainment, categories_bar1.food, categories_bar1.lodging, categories_bar1.transport, categories_bar1.lifestyle, categories_bar1.medical, categories_bar1.other, '']);
        } else {
            barchartdata.push([from_to, categories_bar1.fuel, categories_bar1.entertainment, categories_bar1.food, categories_bar1.lodging, categories_bar1.transport, categories_bar1.other, '']);
        }

    }

    if (categories_bar2) {
        from_to = showDayMonth(fromdate3) + "-\n" + showDayMonth(todate3);
        if (userAcType == "personal") {
            barchartdata.push([from_to, categories_bar2.fuel, categories_bar2.entertainment, categories_bar2.food, categories_bar2.lodging, categories_bar2.transport, categories_bar2.lifestyle, categories_bar2.medical, categories_bar2.other, '']);
        } else {
            barchartdata.push([from_to, categories_bar2.fuel, categories_bar2.entertainment, categories_bar2.food, categories_bar2.lodging, categories_bar2.transport, categories_bar2.other, '']);
        }

    }

    drawBillsChart("piechart", piechartdata, `Last ${days} days Expenses`);
    drawBillsChart("barchart", barchartdata, `Last ${days} days Expenses`, false);
    drawBillsChart("barchartstacked", barchartdata, `Last ${days} days Expenses`, true);
}


function dateDifference(date1, date2) {
    let d1 = new Date(date1.split('/')[2], date1.split('/')[1] - 1, date1.split('/')[0]);
    let d2 = new Date(date2.split('/')[2], date2.split('/')[1] - 1, date2.split('/')[0]);
    let timeDiff = Math.abs(d2.getTime() - d1.getTime());
    let diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return diffDays;
}

function calculatedTotals(vals) {
    let categories = {
        entertainment: 0,
        fuel: 0,
        transport: 0,
        food: 0,
        lodging: 0,
        other: 0
    };
    if (userAcType == "personal") {
        categories.medical = 0;
        categories.lifestyle = 0;
    }


    vals.forEach(function(dat) {
        categories[dat.category] = categories[dat.category] + dat.total;
    });
    return categories;
}

function showDayMonth(d) {
    let _date = d.split("/").splice(0, 2);
    return _date.join("/");
}







//---------------------------------------------------------------------------------------

let logOutBtn = document.getElementById("logout");
let alertBoxWindow = document.getElementById("alertBoxWindow");
let mainStatusOK = document.getElementById("mainStatusOK");
let mainStatusCancel = document.getElementById("mainStatusCancel");
let mainStatusMsg = document.querySelector("#alertBoxWindow h4");

let callbackConfirm = {
    yes: {
        arg: null,
        method: null
    },
    no: {
        arg: null,
        method: null
    }
};


function clearCallbacks() {
    setTimeout(() => {
        callbackConfirm.yes.method = null;
        callbackConfirm.yes.arg = null;
        callbackConfirm.no.method = null;
        callbackConfirm.no.arg = null;
    }, 1000);

}

mainStatusCancel.addEventListener("click", function() {
    alertBoxWindow.classList.add("hide");
    if (callbackConfirm.no.method !== null) {
        callbackConfirm.no.method(callbackConfirm.no.arg);
    }
    clearCallbacks();

});

mainStatusOK.addEventListener("click", function() {
    alertBoxWindow.classList.add("hide");
    if (callbackConfirm.yes.method !== null) {
        callbackConfirm.yes.method(callbackConfirm.yes.arg);
    }
    clearCallbacks();
});

function showAlertBox(msg, oktext, canceltext, isConfirmType, okcallback, okparams, cancelcallback, cancelparams) {
    alertBoxWindow.classList.remove("hide");
    mainStatusMsg.innerText = msg;
    mainStatusOK.innerText = oktext;
    if (isConfirmType) {
        mainStatusCancel.innerText = canceltext;
        mainStatusCancel.classList.remove("hide");
        callbackConfirm.yes.method = okcallback;
        callbackConfirm.yes.arg = okparams;
        callbackConfirm.no.method = cancelcallback;
        callbackConfirm.no.arg = cancelparams;
    } else {
        mainStatusCancel.classList.add("hide")
    }
}


logOutBtn.addEventListener("click", function() {
    sessionStorage.clear();
    location.replace("/")
});


function initLoad() {
    billshomeBtn.click();
    $("#date_field").datepicker({ dateFormat: "dd/mm/yy" });
    let temp_projid = localStorage.getItem("tempProjID") || "";
    if (temp_projid !== "") { removeTempProject(temp_projid) }
    let accountchangeUser = localStorage.getItem("accountchange") || "";
    let projectchangeUser = localStorage.getItem("projectchange") || "";
    if (accountchangeUser != "") {
        localStorage.removeItem("accountchange");
        let atype = accountchangeUser == "team" ? "Business Account" : "Personal Account";
        let logmsg = "You are now logged into your " + atype;
        showAlertBox(logmsg, "OK", null, false);
    } else if (projectchangeUser == "yes") {
        localStorage.removeItem("projectchange");
        showAlertBox("Project Changed Successfuly", "OK", null, false);
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