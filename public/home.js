let allBillsData = null;
let billsObjRef = {};
let selectedBillId = "";
let billMode = "save";
let currentUploadStatus = "";
let currentPage = "";
let userAcType = "";
let teamAcRights = "";
let globalAdminRight = false;
let remPreviousActiveTab = "";
let selectedProjectID = "";
let projectMemberRole = "";
let selectedProjectName = "";
let uncategorisedBillItems = [];

const authVars = { em: sessionStorage.getItem("em"), agent: btoa(navigator.userAgent), key_serv: sessionStorage.getItem("skey") };
const bodyParams = (params) => {
    let paramObj = { ...authVars, ...params };
    return paramObj;
}



//-------------------------------------------------------------------------
//              HOME PAGE
//-------------------------------------------------------------------------


const billshomeBtn = document.getElementById("billshome");
const saveBillBtn = document.getElementById("savebill");
const deleteBillBtn = document.getElementById("deletebill");
const exitBillBtn = document.getElementById("exitbill");
const updateBillBtn = document.getElementById("updatebill");
const approveBillBtn = document.getElementById("approvebill");
const rejectBillBtn = document.getElementById("rejectbill");
const infotipcloseBtn = document.getElementById("infotipclose");
const teamOrMyBills = document.querySelector("#mybillORall p");
const amountStatusSkip = document.getElementById("amountStatusSkip");
const previewBillImage = document.querySelector(".previewimg");
const billThumbNails = document.getElementById("billThumbnails");
const billTable = document.getElementById("billTable");
const billStatusBlock = document.querySelector(".bill-status-approval");
const captureImg = document.getElementById('captureImg');
const billImageFile = document.getElementById('billImageFile');
const imageUploader = document.getElementById("imageuploader");
const uncategorisedMainPanel = document.getElementById("uncategorised-bills");
const exitUncategorisedBills = document.querySelector("#uncategorised-bills > div svg");
const uncategorisedBtn = document.getElementById("link-uncateg");



billshomeBtn.addEventListener("click", function() {
    if (currentPage !== "bills") {
        currentPage = "bills";
        activeNavTab(billshomeBtn);
        hideElements([chartsBlock, settingsBlock]);
        mainContainer.classList.remove("settingMode");
        preloader.classList.remove("hide");
        document.querySelector("title").innerText = "Bill Vault";
        document.getElementById("mybillORall").style.display = "none";
        fetchBills();
    }

});

teamOrMyBills.addEventListener("click", function() {
    let pvt = sessionStorage.getItem("is_private_team");
    if (!pvt || pvt == "private") {
        sessionStorage.setItem("is_private_team", "team");
    } else {
        sessionStorage.setItem("is_private_team", "private");
    }
    if (currentPage == "charts") {
        document.getElementById("chartsBlock").classList.add("hide");
        document.getElementById("mybillORall").style.display = "none";
        preloader.classList.remove("hide");
        loadCharts();
    } else {
        location.reload();
    }

});

billStatusBlock.addEventListener("click", function() {
    document.getElementById("infoTipBox").classList.remove("hide");
    let history = document.getElementById("infoTipBox").getAttribute("data-history");
    let historyLog = JSON.parse(atob(history));
    document.getElementById("infocontent").innerHTML = historyLog.join("<br><br>");
});

amountStatusSkip.addEventListener("click", function() {
    confirmAmountWindow.classList.add("hide");

});


captureImg.addEventListener('change', () => {
    /*if (currentUploadStatus == "progress") {
        showAlertBox("Please wait for your previous Bill receipt to get processed.", "OK", null, false)
    } else if (currentUploadStatus == "unsaved") {
        showAlertBox("You have not saved the current Bill Receipt", "OK", null, false)
    } else {
        readAttachedBill(captureImg.files[0], null);
    }*/
    if (currentUploadStatus == "") {
        readAttachedBill(captureImg.files[0], null);
    } else {
        uncategorisedBillItems.push(captureImg.files[0]);
        processUncategorisedBillItems();
    }


});

billImageFile.addEventListener('change', () => {
    /*if (currentUploadStatus == "progress") {
        showAlertBox("Please wait for your previous Bill receipt to get processed.", "OK", null, false)
    } else if (currentUploadStatus == "unsaved") {
        showAlertBox("You have not saved the current Bill Receipt", "OK", null, false)
    } else {
        if (billImageFile.files.length == 1) {
            readAttachedBill(billImageFile.files[0], null);

        }*/
    if (billImageFile.files.length > 1 || currentUploadStatus !== "") {
        for (let i = 0; i < billImageFile.files.length; i++) {
            uncategorisedBillItems.push(billImageFile.files[i]);
        }
        processUncategorisedBillItems();

    } else if (billImageFile.files.length == 1) {
        readAttachedBill(billImageFile.files[0], null);
    }

    //}

});

exitUncategorisedBills.addEventListener("click", function() {
    uncategorisedMainPanel.classList.add("hide");
    uncategorisedBtn.classList.remove("hide");
});

uncategorisedBtn.addEventListener("click", function() {
    uncategorisedMainPanel.classList.remove("hide");
    uncategorisedBtn.classList.add("hide");
});

function uncategorisedID() {
    var chars = "qwertyuioplkjhgfdsazxcvbnm";
    var newID = "";
    for (var i = 0; i < 15; i++) {
        var rnd = Math.floor(Math.random() * chars.length)
        newID = `${newID}${chars.substr(rnd,1)}`
    }
    return "UN-CTG-" + newID;
}


function processUncategorisedBillItems() {
    if (uncategorisedBillItems.length > 0) {
        const uncategorisedSection = document.querySelector("#uncategorised-bills section");
        const divElt = document.createElement("div");
        const itemID = uncategorisedID();
        divElt.className = "uncategorised-item";
        divElt.setAttribute("id", itemID);

        const svgPreloader = `<svg width="20px" height="20px" viewBox="0 0 128 128" xml:space="preserve"><g><circle cx="16" cy="64" r="16" fill="#000000" fill-opacity="1"/><circle cx="16" cy="64" r="16" fill="#555555" fill-opacity="0.67" transform="rotate(45,64,64)"/><circle cx="16" cy="64" r="16" fill="#949494" fill-opacity="0.42" transform="rotate(90,64,64)"/><circle cx="16" cy="64" r="16" fill="#cccccc" fill-opacity="0.2" transform="rotate(135,64,64)"/><animateTransform attributeName="transform" type="rotate" values="0 64 64;315 64 64;270 64 64;225 64 64;180 64 64;135 64 64;90 64 64;45 64 64" calcMode="discrete" dur="1040ms" repeatCount="indefinite"></animateTransform></g></svg>`;

        const innerContent = `<p><span class="UN-CTG-view CTGloading">${svgPreloader}</span><span class="UN-CTG-remove"><img src="images/trashcan.png" alt="" /></span></p><p><span class="UN-CTG-title"></span><span class="UN-CTG-date"></span><span class="UN-CTG-amount"></span></p><p><img class="billsnapshot" src="" alt="" /></p>`;
        divElt.innerHTML = innerContent;
        uncategorisedSection.appendChild(divElt);
        uncategorisedMainPanel.classList.remove("hide");
        const viewElt = document.querySelector(`#${itemID} .UN-CTG-view`);
        const removeElt = document.querySelector(`#${itemID} .UN-CTG-remove`);

        viewElt.addEventListener("click", function(evt) {
            const parentElt = evt.currentTarget.parentNode;
            const date = parentElt.parentNode.getAttribute("data-date");
            const descr = parentElt.parentNode.getAttribute("data-descr");
            const title = parentElt.parentNode.getAttribute("data-title");
            let total = parentElt.parentNode.getAttribute("data-amount");
            if (total.indexOf(",") > 0) {
                total = total.split(",");
            }
            const type = "";
            document.querySelector('.previewimg img').src = parentElt.parentNode.querySelector(`img.billsnapshot`).src;
            imageProcessDone({ date, total, descr, title, type });
            uncategorisedMainPanel.classList.add("hide");
            uncategorisedMainPanel.setAttribute("data-mode", "active");
            uncategorisedBtn.classList.add("hide");

        });

        removeElt.addEventListener("click", function(evt) {
            const p1 = evt.currentTarget.parentNode;
            p1.parentNode.remove();
            if (document.querySelectorAll(".uncategorised-item").length == 0) {
                uncategorisedMainPanel.classList.add("hide");
                uncategorisedBtn.classList.add("hide");
            }
        });
        readAttachedBill(uncategorisedBillItems[0], `#${itemID} img.billsnapshot`);
        uncategorisedBillItems.splice(0, 1);
    } else {
        preloader.classList.add("hide");
        currentUploadStatus = "";
    }
}

function insertDataIntoUncategorisedItems(resultData, itemElt) {
    const title = document.querySelector(`${itemElt} .UN-CTG-title`);
    const amount = document.querySelector(`${itemElt} .UN-CTG-amount`);
    const date = document.querySelector(`${itemElt} .UN-CTG-date`);
    const viewBtn = document.querySelector(`${itemElt} .UN-CTG-view`);
    viewBtn.innerHTML = "View";
    viewBtn.classList.remove("CTGloading");

    const item_Elem = document.querySelector(itemElt);
    item_Elem.setAttribute("data-date", resultData.date || "");
    item_Elem.setAttribute("data-title", resultData.title || "");
    item_Elem.setAttribute("data-descr", resultData.descr || "");
    title.textContent = resultData.title || "??";
    date.textContent = resultData.date || "??";

    let totalamount = resultData.total || "";
    if (typeof totalamount != "string" && typeof totalamount != "number") {
        let amtvals = [];
        totalamount.forEach(amt => {
            let rounded = Math.round(amt);
            if (amtvals.indexOf(rounded) == -1) {
                amtvals.push(rounded);
            }
        });
        if (amtvals.length == 1) {
            amount.textContent = "Rs " + amtvals[0];
            item_Elem.setAttribute("data-amount", amtvals[0]);
        } else {
            amount.textContent = "Amount: [Unconfirmed]";
            item_Elem.setAttribute("data-amount", `${amtvals[0]},${amtvals[1]}`);
        }

    } else {
        amount.textContent = "Amount: Rs " + totalamount;
        item_Elem.setAttribute("data-amount", totalamount);
    }

}

function readAttachedBill(imgfile, queueProcessMode) {
    let previewImgStr = queueProcessMode == null ? '.previewimg img' : queueProcessMode;
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
            document.querySelector(previewImgStr).src = srcData;
            getOrientation(imgfile, function(orient) {
                let byteSize = (4 * srcData.length / 3) / 1024 / 1024;
                if (byteSize < 3 && orient <= 1) {
                    BillImgProcessing(srcData, previewImgStr);
                } else {
                    resetOrientation(srcData, orient, function(newImgData) {
                        BillImgProcessing(newImgData, previewImgStr);

                    });
                }
            });

        }

        fileReader.readAsDataURL(imgfile);

    } else if (imgfile.type.indexOf("application/pdf") > -1) {
        const pdf_file = imgfile;
        currentUploadStatus = "progress";
        preloader.classList.remove("hide");
        PDF_IMG_converter.sendFile(pdf_file, previewImgStr);
    } else {
        alert("This File is not supported")
    }

}

function BillImgProcessing(imgdata, previewImgStr) {
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
                    document.querySelector(previewImgStr).src = imgdata;
                    if (previewImgStr.indexOf("#UN-CTG-") == 0) {
                        insertDataIntoUncategorisedItems(txtjson.status, previewImgStr.split(" ")[0]);
                        processUncategorisedBillItems();
                    } else {
                        imageProcessDone(txtjson.status);
                    }

                }).catch(function(s) {
                    document.querySelector(previewImgStr).src = imgdata;
                    if (previewImgStr.indexOf("#UN-CTG-") == 0) {
                        insertDataIntoUncategorisedItems({}, previewImgStr.split(" ")[0]);
                        processUncategorisedBillItems();
                    } else {
                        imageProcessDone({});
                    }
                });
        }).catch(function(err) {
            document.querySelector(previewImgStr).src = imgdata;
            if (previewImgStr.indexOf("#UN-CTG-") == 0) {
                insertDataIntoUncategorisedItems({}, previewImgStr.split(" ")[0]);
                processUncategorisedBillItems();
            } else {
                imageProcessDone({});
                showAlertBox("Server Busy at the moment", "OK", null, false);
            }

        })

}

const PDF_IMG_converter = {
    sendFile: function(pdf, previewImgStr) {
        const pdf_url = URL.createObjectURL(pdf);
        const thecanvas = document.getElementById("pdf-canvas");
        let canvas_CTX = thecanvas.getContext('2d');
        PDFJS.getDocument({ url: pdf_url }).then(function(pdf_doc) {
            pdf_doc.getPage(1).then(function(page) {
                // As the canvas is of a fixed width we need to set the scale of the viewport accordingly
                var scale_required = thecanvas.width / page.getViewport(1).width;
                var viewport = page.getViewport(scale_required);
                thecanvas.height = viewport.height;

                const renderContext = {
                    canvasContext: canvas_CTX,
                    viewport: viewport
                };

                // Render the page contents in the canvas
                page.render(renderContext).then(function() {
                    let canvasData = thecanvas.toDataURL("image/jpeg", 0.8);
                    BillImgProcessing(canvasData, previewImgStr);
                });
            });
        }).catch(function(error) {
            alert("Oops, Unable to process your PDF file");
            console.log(error.message)
        });
    }
};


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
    let img = new Image();
    img.onload = function() {
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
    hideElements([billStatusBlock, approveBillBtn, rejectBillBtn, updateBillBtn, deleteBillBtn, preloader, billThumbNails]);
    showElements([exitBillBtn, saveBillBtn]);
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
        categoriy_opts.push({ text: "LifeStyle (Clothing/Footwear/accessories)", val: "lifestyle" });
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
    const client = sessionStorage.getItem("ckey") || false;
    const serv = sessionStorage.getItem("skey") || false;
    const sessionemail = sessionStorage.getItem("em") || false;
    const type = sessionStorage.getItem("is_private_team") || "private";
    const initData = (bdata) => {
        userAcType = bdata.user_data.account;
        teamAcRights = bdata.user_data.controls;
        globalAdminRight = (bdata.user_data.isGlobalAdmin == "yes") ? true : false;
        localStorage.setItem("theme", bdata.user_data.defaultskin);
        document.querySelector("body").setAttribute("class", bdata.user_data.defaultskin);
        preloader.classList.add("hide");
    }

    if (client && serv && sessionemail) {
        fetch("../loadBills/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ ptype: type })) })
            .then(data => data.json())
            .then(function(res) {
                if (res.status == "invalid") {
                    sessionStorage.clear();
                    preloader.classList.add("hide");
                }
                if (res.status == "notinteam") {
                    initData(res);
                    showAlertBox("You are not in any Project", "OK", null, false);
                }
                if (res.status == "done") {
                    detectDeviceCam(function(hascam) {
                        if (hascam) { document.getElementById("cameraDevice").classList.remove("hide") }
                    });
                    initData(res);
                    if (userAcType == "team") {
                        selectedProjectID = res.user_data.activeProjectID || "";
                        projectMemberRole = res.user_data.role || "";
                        let header_logo_img = res.user_data.logo || "";
                        document.querySelector("header > img").src = (header_logo_img == "") ? "images/logo-sq.png" : header_logo_img;
                        selectedProjectName = res.user_data.projname || "";
                        projectNameHead.innerHTML = "<b>Project:</b>&nbsp;" + selectedProjectName;
                        projectNameHead.style.display = "block";
                        if (projectMemberRole != "member") {
                            document.getElementById("mybillORall").style.display = "block";
                        }

                        if (type == "team") {
                            teamOrMyBills.innerText = "Show only My Bills";
                            allBillsData = JSON.parse(res.user_data.allProjMembers);
                        } else {
                            document.getElementById("imageuploader").classList.remove("hide");
                            teamOrMyBills.innerText = (projectMemberRole == "admin") ? "Show Team's Bills" : "Show my reportess Bills";
                            allBillsData = res.user_data.user_bills;
                        }

                    } else {
                        document.getElementById("imageuploader").classList.remove("hide");
                        allBillsData = res.user_data.user_bills;
                    }

                    addCategorySelectOptions();
                    displayBillThumbnails();

                }
            }).catch(function(e) {
                showAlertBox("Server Busy!", "OK", null, false);
                preloader.classList.add("hide");
            });
    }
}

function displayBillingTable(data) {
    let totalamount = data.total || "";
    if (typeof totalamount != "string" && typeof totalamount != "number") {
        let amtvals = [];
        totalamount.forEach(amt => {
            let rounded = Math.round(amt);
            if (amtvals.indexOf(rounded) == -1) {
                amtvals.push(rounded);
            }
        });
        if (amtvals.length == 1) {
            document.getElementById("amount_field").value = "Rs " + amtvals[0];
        } else {
            ConfirmAmountBox(amtvals.slice(0, 2));
        }

    } else {
        document.getElementById("amount_field").value = "Rs " + totalamount;
    }

    showElements([billTable, previewBillImage]);
    document.getElementById("date_field").value = data.date || "";
    document.getElementById("merchant_field").value = data.title || "";
    document.getElementById("descr_field").value = data.descr || "";
    document.getElementById("billtype").value = data.type || "";
    document.querySelector(".previewimg").style.height = "auto";
    setTimeout(function() {
        let previewimgHeight = document.querySelector(".previewimg img").height;
        if (document.querySelector(".previewimg").offsetHeight > previewimgHeight) {
            document.querySelector(".previewimg").style.height = previewimgHeight + "px"
        }
    }, 1000);
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
        div.setAttribute("id", "thumb_" + bill.id);
        div.setAttribute("data-billvals", btoa(JSON.stringify(billData)));
        div.className = "thumbnail";
        div.innerHTML = thumbs;

        let privateTeam = sessionStorage.getItem("is_private_team");
        if (userAcType == "team" && privateTeam == "team") {
            div.setAttribute("data-owner", bill.useremail);
        }

        if (userAcType == "team") {
            div.setAttribute("data-billstatus", bill.status);
            div.setAttribute("data-billapprover", bill.approver);
            div.setAttribute("data-history", btoa(JSON.stringify(bill.history)));
        }
        billsObjRef[bill.id] = billImg;
        thumbnails.appendChild(div);
        div.addEventListener("click", function(ev) {
            billMode = "update";
            thumbNailClicked(ev.currentTarget);
        });
    });

}

function thumbNailClicked(thumbnail) {
    let values = thumbnail.getAttribute("data-billvals");
    selectedBillId = thumbnail.getAttribute("id").split("mb_")[1];
    hideElements([rejectBillBtn, approveBillBtn, saveBillBtn, billThumbNails, imageUploader]);
    showElements([exitBillBtn, updateBillBtn, deleteBillBtn]);
    document.querySelector('.previewimg img').setAttribute("src", billsObjRef[selectedBillId]);
    displayBillingTable(JSON.parse(atob(values)));
    if (userAcType == "team") {
        let _status = thumbnail.getAttribute("data-billstatus");
        let _approver = thumbnail.getAttribute("data-billapprover");
        let privateTeam = sessionStorage.getItem("is_private_team") || "private";
        billStatusBlock.classList.remove("approved");
        billStatusBlock.classList.remove("rejected");
        billStatusBlock.classList.remove("pending");
        billStatusBlock.classList.add(_status);
        if (_status == "approved" || (projectMemberRole != "member" && privateTeam == "team")) {
            hideElements([updateBillBtn, deleteBillBtn]);
            resetTableFields("disable");
        }
        if (_status == "approved") {
            document.querySelector("#billTable .table-head").innerHTML = "Bill Details";
        }
        if (_status != "approved" && projectMemberRole == "admin" && privateTeam == "private") {
            approveBillBtn.classList.remove("hide");
            approveBillBtn.innerText = "Self Approve";
        } else {
            approveBillBtn.innerText = "Approve";
        }
        if (projectMemberRole != "member" && privateTeam == "team") {
            if (_status !== "approved") {
                if (projectMemberRole == "admin" && _approver != atob(authVars.em)) {
                    hideElements([approveBillBtn, rejectBillBtn]);
                } else {
                    showElements([approveBillBtn, rejectBillBtn]);
                }
            }
            if (_status == "rejected") {
                rejectBillBtn.classList.add("hide");
            }

            let owner = thumbnail.getAttribute("data-owner");
            document.querySelector("#billTable .table-head").innerHTML = `Bill Details <span>${owner}</span>`;
        }
        if (_status == "pending") {
            _status = " is <b>pending approval</b> from ";
        } else {
            _status = " was <b>" + _status + "</b> by ";
        }
        let historyIconSVG = `<svg height="20" width="20" viewBox="0 0 551.13 551.13">
            <g><path d="m275.531 172.228-.05 120.493c0 4.575 1.816 8.948 5.046 12.177l86.198 86.181 24.354-24.354-81.153-81.136.05-113.361z"></path>
            <path d="m310.011 34.445c-121.23 0-221.563 90.033-238.367 206.674h-71.644l86.114 86.114 86.114-86.114h-65.78c16.477-97.589 101.355-172.228 203.563-172.228 113.966 0 206.674 92.707 206.674 206.674s-92.707 206.674-206.674 206.674c-64.064 0-123.469-28.996-162.978-79.555l-27.146 21.192c46.084 58.968 115.379 92.808 190.124 92.808 132.955 0 241.119-108.181 241.119-241.119s-108.164-241.119-241.119-241.12z"></path></g>
        </svg>`;
        document.getElementById("billTable").classList.add("teamTable");
        billStatusBlock.classList.remove("hide");
        billStatusBlock.innerHTML = `This Bill${_status}<span>${_approver}</span><i>${historyIconSVG}</i>`;
        document.getElementById("infoTipBox").setAttribute("data-history", thumbnail.getAttribute("data-history"));
        uncategorisedMainPanel.setAttribute("data-mode", "");
        uncategorisedMainPanel.classList.add("hide");
        if (document.querySelectorAll(".uncategorised-item").length > 0) {
            uncategorisedBtn.classList.remove("hide");
        }

    }
}


function tidyAmount(amt) {
    let amount = amt.trim();
    // example: This RegExp matches 'Rs.230' or 'Rs230' or '230 Rs' or '230Rs'
    let total = (amount).match(/^((Rs(\.)?\s?)?(\d+\.?\d*)|(\d+\.?\d*)\s?(Rs)?)$/i);
    let rupees = total !== null ? total.filter(rs => !isNaN(rs))[0] : total;
    if (rupees == null || rupees > 999999) { return 0; }
    return rupees;
}


function resetTableFields(state) {
    let fields = ["merchant_field", "amount_field", "descr_field"];
    fields.forEach(function(field) {
        if (state == "disable") {
            document.getElementById(field).setAttribute("readonly", true);
        } else {
            document.getElementById(field).removeAttribute("readonly");
        }
    });
    if (state == "disable") {
        document.getElementById("billTable").classList.add("static-table");
        document.getElementById("billtype").disabled = true;

    } else {
        document.getElementById("billTable").classList.remove("static-table");
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
    inProgressTextStatus(updateBillBtn, "Updating, please wait...", true);
    hideElements([exitBillBtn, deleteBillBtn, approveBillBtn]);

    const billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    let encodedBill = "";
    if (userAcType == "personal") {
        encodedBill = encryptData(billdata, { serv: serv, cli: client });
    } else {
        encodedBill = btoa(JSON.stringify(billdata));
    }
    fetch("../updateBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ receiptid: selectedBillId, bdata: encodedBill })) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "updated") {
                inProgressTextStatus(updateBillBtn, "Update", false);
                location.reload();

            }
        }).catch(function() {
            inProgressTextStatus(updateBillBtn, "Update", false);
            showElements([deleteBillBtn, exitBillBtn]);
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });

}

function deleteBill() {
    inProgressTextStatus(deleteBillBtn, "Deleting...", true);
    hideElements([updateBillBtn, exitBillBtn, approveBillBtn]);
    const client = sessionStorage.getItem("ckey");
    const serv = sessionStorage.getItem("skey");
    const sessionemail = sessionStorage.getItem("em");
    fetch("../deleteBill/", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ receiptid: selectedBillId })) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "deleted") {
                inProgressTextStatus(deleteBillBtn, "Delete", false);
                location.reload();

            }
        }).catch(function() {
            inProgressTextStatus(deleteBillBtn, "Delete", false);
            showElements([exitBillBtn, updateBillBtn]);
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);
        });

}



function saveBill(bill, email, serv) {
    let type = sessionStorage.getItem("is_private_team") || "private";
    fetch("../saveBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ receipt: bill })) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
            }
            if (res.status == "duplicate_bill") {
                inProgressTextStatus(saveBillBtn, "Save", false);
                exitBillBtn.classList.remove("hide");
                showAlertBox("Sorry, can not Save.\nThis Bill already exists", "OK", null, false);
            }
            if (res.status == "saved") {
                exitBillBtn.click();
                inProgressTextStatus(saveBillBtn, "Save", false);
                exitBillBtn.classList.remove("hide");
                currentUploadStatus = "";
                location.reload();
            }
        }).catch(function() {
            inProgressTextStatus(saveBillBtn, "Save", false);
            preloader.classList.add("hide");
            exitBillBtn.classList.remove("hide");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);
        });
}


function approveRejectBill(mode) {
    let billAmount = document.getElementById("amount_field").value;
    let billName = document.getElementById("merchant_field").value;
    let useremail = document.querySelector("#billTable .table-head span");
    if (useremail == null) {
        useremail = atob(authVars.em);
    } else {
        useremail = useremail.innerText;
    }

    fetch("../approveRejectBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ billid: selectedBillId, proj: selectedProjectID, user: useremail, mode: mode, amount: billAmount, billname: billName })) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "approved") {
                approveBillBtn.innerText = "Approved";
                setTimeout(function() {
                    location.reload();
                }, 1500);
            }
            if (res.status == "rejected") {
                rejectBillBtn.innerText = "Done!";
                setTimeout(function() {
                    location.reload();
                }, 1500);
            }

            if (res.status == "invalid") {
                sessionStorage.clear();
            }
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
    if (billType == "") {
        showAlertBox("Please select a Category", "OK", null, false);
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
    inProgressTextStatus(saveBillBtn, "Saving, please wait...", true);
    hideElements([exitBillBtn, deleteBillBtn]);
    saveBill(billObj, sessEmail, serv);
});


updateBillBtn.addEventListener("click", function() {
    updateBill();
});

approveBillBtn.addEventListener("click", function() {
    inProgressTextStatus(approveBillBtn, "Approving...", true);
    hideElements([exitBillBtn, rejectBillBtn, updateBillBtn, deleteBillBtn]);
    approveRejectBill("approved");
});

rejectBillBtn.addEventListener("click", function() {
    inProgressTextStatus(rejectBillBtn, "Rejecting...", true);
    hideElements([exitBillBtn, approveBillBtn]);
    approveRejectBill("rejected");
});


infotipcloseBtn.addEventListener("click", function() {
    document.getElementById("infoTipBox").classList.add("hide");
    document.getElementById("infocontent").innerHTML = "";

});

deleteBillBtn.addEventListener("click", function() {
    showAlertBox("Are you sure you want to Delete this Bill?", "Yes", "No", true, deleteBill, null, null, null);

});

exitBillBtn.addEventListener("click", function() {
    document.getElementById("date_field").value = "";
    document.getElementById("merchant_field").value = "";
    document.getElementById("amount_field").value = "";
    document.querySelector('.previewimg img').setAttribute("src", "");
    hideElements([preloader, previewBillImage, billTable])
    resetTableFields("");
    currentUploadStatus = "";

    if (billMode == "update") {
        let type = sessionStorage.getItem("is_private_team") || "private";
        if (type == "private") {
            document.getElementById("imageuploader").classList.remove("hide");
        }

        billMode = "save";
    }
    document.getElementById("billThumbnails").classList.remove("hide");
    if (uncategorisedMainPanel.getAttribute("data-mode") == "active") {
        uncategorisedMainPanel.classList.remove("hide")
    }

});






//-------------------------------------------------------------------------
//          SETTINGS PAGE
//-------------------------------------------------------------------------

const settingsBlock = document.getElementById("settingsBlock")
const settingsBtn = document.getElementById("settings");
const profileImgBtn = document.getElementById("profile_img_browse");
const teamImgBtn = document.getElementById("team_img_browse");
const teamImgEditBtn = document.getElementById("team_imgEdit");
const savesettingsBtn = document.getElementById("savesettings");
const closesettingsBtn = document.getElementById("closesettings");
const saveCloseSetting = document.getElementById("saveCloseSetting");
const userSettingLink = document.getElementById("user_setting_link");
const teamSettingLink = document.getElementById("team_setting_link");
const createNewTeamBtn = document.getElementById("createNewTeam");
const addNewMemberProjBtn = document.getElementById("addNewMemberProj");
const projectsListBlock = document.getElementById("projectsList");
const editProjectBtn = document.getElementById("editProject");
const addmemberEditBtn = document.getElementById("addmemberEdit");

let myProjectSelect = document.getElementById("myProject_select");
let projectNameHead = document.getElementById("projectNameHead");
let userAccField = document.getElementById("user_account_field");
let enableAddNewMember = false;
let isProfilePicModified = false;
let isLogoModified = false;
let saveSettingEnabled = false;
let editProjectMode = false;
let initAccountVals = { name: "", type: "", projchange: false };

settingsBtn.addEventListener("click", function() {
    if (currentPage !== "settings" && userAcType !== "") {
        remPreviousActiveTab = currentPage;
        currentPage = "settings";
        activeNavTab(settingsBtn);
        hideElements([savesettingsBtn, teamSettingLink]);
        settingsBlock.classList.remove("hide");
        document.querySelector('.settingloadstatus').classList.remove("hide");
        mainContainer.classList.add("settingMode");
        saveSettingEnabled = false;
        userSettingLink.click();
        loadAccountSettings();
        document.querySelector("title").innerText = "Settings | Bill Vault";
        // for devices smaller than 375px width, always keep topfloater class in Settings Mode
        if (window.innerWidth < 375) {
            mainContainer.classList.add("topfloater")
        }

    }
});

editProjectBtn.addEventListener("click", function() {
    inProgressTextStatus(editProjectBtn, "please wait...", true);
    editProjectBtn.classList.remove("btn");
    editProjectBtn.classList.remove("btn-editproj");
    editProjectMode = true;
    getMembersList("");

});

addmemberEditBtn.addEventListener("click", function() {
    addmemberEditBtn.remove();
    let newDiv = document.createElement("div");
    newDiv.setAttribute("id", "editProjAddOne");
    newDiv.innerHTML = `   
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
    document.getElementById("editProjMembersPanel").appendChild(newDiv)
});



profileImgBtn.addEventListener('change', () => {
    attachProfileImage(profileImgBtn.files[0], "userimage", null);

});


teamImgBtn.addEventListener('change', () => {
    attachProfileImage(teamImgBtn.files[0], "logo", "teamlogoImg");

});


teamImgEditBtn.addEventListener('change', () => {
    attachProfileImage(teamImgEditBtn.files[0], "logo", "teamlogoImgModify");

});

savesettingsBtn.addEventListener("click", function() {

    if (!saveSettingEnabled) {
        return;
    }

    isTempProj = localStorage.getItem("tempProjID") || "";
    if (isTempProj != "") {
        showAlertBox(`You have not assigned Members for the New Project: ${document.getElementById("displayteamname").value}`, "OK", null, false);
        return;
    }

    const editedProjVals = getEditedProjectVals();
    if (editedProjVals == "invalidProjName") {
        return;
    }

    const insertedOneVals = checkEditInsertedOne();
    if (insertedOneVals == "invalid") {
        return;
    }

    const prof_img = document.getElementById("userprofilepic").getAttribute("src");
    const disp_name = document.getElementById("displayname_field").value;
    const acc_type = document.getElementById("user_account_field").value;

    if (disp_name !== initAccountVals.name || acc_type !== initAccountVals.type || isProfilePicModified || initAccountVals.projchange || editedProjVals != "none" || insertedOneVals != "none") {
        saveSettingEnabled = false;
        closesettingsBtn.classList.add("hide");

        let accountObj = {
            profile_img: prof_img,
            displayname: disp_name,
            account: acc_type,
            isSwitchedProj: "no",
            editedProjectVals: editedProjVals,
            insertedOneVals: insertedOneVals
        }
        if (initAccountVals.projchange) {
            accountObj.isSwitchedProj = "yes";
            accountObj.newProjectID = myProjectSelect.value;
        }
        inProgressTextStatus(savesettingsBtn, "Saving...", true);
        saveSettings(accountObj);
    } else {
        closesettingsBtn.click();
    }
});

function saveSettings(accSettingObj) {
    fetch("../settingsave/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ usersetting: btoa(JSON.stringify(accSettingObj)) })) })
        .then(data => data.json())
        .then((setting) => {
            if (setting.status == "invalid") {
                sessionStorage.clear();
            }
            if (setting.status == "invalidEmail") {
                showAlertBox(`You have entered Invalid Email`, "OK", null, false);
                saveSettingEnabled = true;
                inProgressTextStatus(savesettingsBtn, "Save", false);
                closesettingsBtn.classList.remove("hide");
            }
            if (setting.status == "saved") {
                if (accSettingObj.account !== initAccountVals.type) {
                    setTimeout(function() {
                        localStorage.setItem("accountchange", accSettingObj.account);
                        location.reload();
                    }, 1000);
                } else if (initAccountVals.projchange) {
                    setTimeout(function() {
                        localStorage.setItem("projectchange", "yes");
                        location.reload();
                    }, 1000);
                } else {
                    isProfilePicModified = false;
                    isLogoModified = false;
                    inProgressTextStatus(savesettingsBtn, "Save", false);
                    closesettingsBtn.classList.remove("hide");
                    initAccountVals.name = accSettingObj.displayname;
                    initAccountVals.type = accSettingObj.account;
                    initAccountVals.projchange = false;
                    saveSettingEnabled = true;
                    if (document.getElementById("teamSettingsPage")) {
                        let isNewProjCreated = document.getElementById("teamSettingsPage").getAttribute("data-projectidnew") || "";
                        if (isNewProjCreated != "") {
                            document.getElementById("teamDetailsSection").classList.add("hide");
                            document.getElementById("createNewTeam").classList.add("hide");
                        }
                    }
                    if (accSettingObj.editedProjectVals != "none") {
                        document.getElementById("modifyProjectMembers").classList.add("hide");
                        editProjectMode = false;
                        editProjectBtn.classList.remove("hide");
                        if (accSettingObj.editedProjectVals.projName != "" || accSettingObj.editedProjectVals.logo != "") {
                            setTimeout(function() {
                                localStorage.setItem("projectmodify", "yes");
                                location.reload();
                            }, 1000);
                        }
                        if (accSettingObj.editedProjectVals.users.length > 0) {
                            removeEditUserGroups()
                        }
                    }
                    if (accSettingObj.insertedOneVals != "none") {
                        location.reload();
                    }
                    closesettingsBtn.click();
                }

            } else if (setting.status && setting.msg) {
                saveSettingEnabled = true;
                showAlertBox(setting.msg, "OK", null, false);
                inProgressTextStatus(savesettingsBtn, "Save", false);
                closesettingsBtn.classList.remove("hide");
            }

        }).catch((s) => {
            saveSettingEnabled = true;
            inProgressTextStatus(savesettingsBtn, "Save", false);
        });
}

function attachProfileImage(imgfile, logoprofile, logoholder) {
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
                if (tempImg.width > 196 || tempImg.height > 105 || tempImg.width < 150) {
                    showAlertBox("Logo Width:Height must be 195px:100px (approx)", "OK", null, false);
                } else {
                    document.getElementById(logoholder).src = srcData;
                    if (logoholder == "teamlogoImgModify") {
                        isLogoModified = true;
                    }
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

function checkEditInsertedOne() {
    if (!editProjectMode) {
        return "none";
    }
    let projEditAddOne = document.getElementById("editProjAddOne") || "";
    if (projEditAddOne != "") {
        let mem_email = projEditAddOne.querySelector(".member-email-field");
        let appr_email = projEditAddOne.querySelector(".approver-email-field");
        let role = projEditAddOne.querySelector(".select-roles-control").value;
        if (mem_email.value.trim() == "") {
            appr_email.value = "";
            return "none";
        }

        if (mem_email.value.trim() == appr_email.value.trim()) {
            appr_email.value = "";
            showAlertBox("Approver's Email must not be the same", "OK", null, false);
            return "invalid";
        }

        if (role == "none") {
            showAlertBox("Please select role", "OK", null, false);
            return "invalid";
        }

        if (appr_email.value.trim() == "") {
            appr_email.value = atob(authVars.em);
        }
        return {
            member: mem_email.value,
            role: role,
            approver: appr_email.value,
            projid: selectedProjectID,
            projName: selectedProjectName,
            logo: ""
        }
    } else {
        return "none";
    }

}


function confirmMemberDeletion(evt) {
    let parentDiv = evt.currentTarget.parentNode;
    let member = parentDiv.getAttribute("data-memberemail");
    showAlertBox(`Do you really want to remove "${member}" from this Project?`, "Yes", "No", true, removeProjMember, { member: member, deletionDIV: parentDiv }, null, null);

}


function removeProjMember(rem) {
    setTimeout(function() {
        showAlertBox(`Deleting "${rem.member}" from Project...`, "", null, false);
    }, 1500);

    fetch("../removeMember/", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ project: myProjectSelect.value, member: rem.member })) })
        .then(data => data.json())
        .then((p) => {
            if (p.status == "deleted-manager") {
                removeEditUserGroups();
                getMembersList("refresh");

            }
            if (p.status == "deleted-member") {
                mainStatusOK.classList.remove("hide");
                rem.deletionDIV.remove();
                mainStatusOK.click();
            }
            if (p.status == "denied") {
                mainStatusOK.classList.remove("hide");
                mainStatusOK.click();
                setTimeout(() => {
                    showAlertBox(`Can not delete member/manager whose bills are approved`, "OK", null, false);
                }, 1500);

            }
        }).catch(err => {
            mainStatusOK.classList.remove("hide");
            mainStatusOK.click();
        })
}

function getMembersList(_auto) {

    fetch("../getProjMembers/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ project: myProjectSelect.value })) })
        .then(data => data.json())
        .then(function(p) {
            if (p.status == "done") {
                inProgressTextStatus(editProjectBtn, "Edit Project", false);
                editProjectBtn.classList.add("btn");
                editProjectBtn.classList.add("btn-editproj");
                editProjectBtn.classList.add("hide");

                document.getElementById("displayteamname_edit").value = selectedProjectName;
                document.querySelector("#modifyProjectMembers h5").innerText = "Edit Project (" + selectedProjectName + ")";
                let team = JSON.parse(p.team);
                let deleteBtnTag = (teamAcRights == "all") ? `<span class="btn deletemember" style="width:auto">Delete</span>` : "&nbsp;";
                if (team.teamlist.length > 0 || projectMemberRole == "admin") {
                    document.getElementById("modifyProjectMembers").classList.remove("hide");
                } else {
                    showAlertBox("Admin has not assigned any members under you.", "OK", null, false);
                }
                team.teamlist.forEach(tl => {
                    let approversList = ``;
                    let approverFilter = team.approvers.filter(appr => appr != tl.member);
                    let approverindex = approverFilter.indexOf(tl.approver);
                    if (approverindex > -1) {
                        approverFilter.splice(approverindex, 1);
                        approverFilter.splice(0, 0, tl.approver);
                    }
                    approverFilter.forEach(approver => {
                        approversList = `${approversList}<option value="${approver}">${approver}</option>`;
                    });
                    let lastApproverChanged = (tl.updated.length == 1) ? `<br><span class="lastapproverlog">${tl.updated[0]}</span>` : "&nbsp;";
                    let div = document.createElement("div");
                    div.setAttribute("class", "edituserGroup");
                    div.setAttribute("data-memberemail", tl.member);
                    div.setAttribute("data-approveremail", tl.approver);
                    div.innerHTML = `   
                        <span class="member-email-field"><b>${tl.member}</b></span><br>
                        <span class="editRoleLabel">
                           ${tl.role}
                        </span>
                        ${deleteBtnTag}
                        <br><br><span>Select Approver</span>
                        <br>
                        <span>
                           <select class="select-approver-control">
                                ${approversList}
                            </select>
                        </span>
                        ${lastApproverChanged}
                        `;
                    document.getElementById("editProjMembersPanel").appendChild(div);
                });

                let projmain = document.querySelectorAll("#modifyProjectMembers > p");
                if (teamAcRights == "all") {
                    if (_auto == "refresh") {
                        mainStatusOK.classList.remove("hide");
                        mainStatusOK.click();
                    }

                    projmain[0].classList.remove("hide");
                    projmain[1].classList.remove("hide");
                    if (addmemberEditBtn) {
                        addmemberEditBtn.classList.remove("hide");
                        document.getElementById("editProjMembersPanel").appendChild(addmemberEditBtn);
                    }
                    let deleteMemberList = document.querySelectorAll(".deletemember");
                    deleteMemberList.forEach((del) => {
                        del.addEventListener("click", confirmMemberDeletion);
                    });
                } else {
                    if (addmemberEditBtn) {
                        addmemberEditBtn.classList.add("hide");
                    }

                    projmain[0].classList.add("hide");
                    projmain[1].classList.add("hide");
                }


            } else {
                inProgressTextStatus(editProjectBtn, "Edit Project", false);
                editProjectBtn.classList.add("btn");
                editProjectBtn.classList.add("btn-editproj");
                editProjectMode = false;
            }
        });

}

function getEditedProjectVals() {
    if (projectMemberRole == "member" || !editProjectMode) {
        return "none";
    }
    let editlist = document.querySelectorAll(".edituserGroup");
    let modifiedList = { logo: "", projName: "", projid: selectedProjectID, users: [] };
    editlist.forEach(editItem => {
        let selectedapprover = editItem.querySelector("select").value;
        if (editItem.getAttribute("data-approveremail") != selectedapprover) {
            modifiedList.users.push({ email: editItem.getAttribute("data-memberemail"), approver: selectedapprover });
        }
    });
    let teamnameEdit = document.getElementById("displayteamname_edit");
    if (teamnameEdit) {
        if (selectedProjectName != teamnameEdit.value) {
            if (validateProjectName(teamnameEdit.value.trim())) {
                modifiedList.projName = teamnameEdit.value;
            } else {
                return "invalidProjName";
            }
        }
    }

    if (isLogoModified) {
        modifiedList.logo = document.getElementById("teamlogoImgModify").getAttribute("src");
    }
    if (modifiedList.logo == "" && modifiedList.projName == "" && modifiedList.users.length == 0) {
        return "none";
    }
    return modifiedList;

}


function loadAccountSettings() {
    document.getElementById("user_account_field").disabled = true;
    document.getElementById("displayname_field").value = "";
    document.getElementById("myemail_field").value = "";
    fetch("../settingsload/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams()) })
        .then(data => data.json())
        .then((setting) => {
            if (setting.status == "invalid") {
                sessionStorage.clear();
            }
            if (setting.status == "done") {
                let settingdata = JSON.parse(atob(setting.accdata));
                document.querySelector('.settingloadstatus').classList.add("hide");
                initAccountVals.name = settingdata.user_name;
                initAccountVals.type = settingdata.user_default;

                if (settingdata.user_photo != "" && settingdata.user_photo.length > 100) {
                    document.getElementById("userprofilepic").setAttribute("src", settingdata.user_photo);
                }
                if (initAccountVals.type == "team") {
                    if (settingdata.teamlist.length > 0 || globalAdminRight) {
                        projectsListBlock.classList.remove("hide");
                        teamSettingLink.classList.remove("hide");
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
                    if (settingdata.teamlist.length == 0 || projectMemberRole == "member") {
                        editProjectBtn.classList.add("hide")
                    }

                    document.querySelector(".user_role").classList.remove("hide");
                    document.getElementById("userrole_field").value = projectMemberRole || "--";
                    if (!globalAdminRight) {
                        if (teamAcRights == "none") {
                            if (projectMemberRole == "member") {
                                if (document.querySelector("#addUserPanel p")) {
                                    document.querySelector("#addUserPanel p").remove()
                                }
                            }
                            document.querySelector('.team-sub-setting').remove();
                            createNewTeamBtn.remove();
                        }
                    }
                } else {
                    if (document.getElementById("teamSettingsPage")) {
                        document.getElementById("teamSettingsPage").remove();
                    }

                }
                document.getElementById("user_account_field").disabled = false;
                document.getElementById("user_account_field").value = initAccountVals.type;
                document.getElementById("displayname_field").value = initAccountVals.name;
                document.getElementById("myemail_field").value = settingdata.user_email;
                savesettingsBtn.classList.remove("hide");
                saveSettingEnabled = true;
            }

        }).catch((s) => {
            document.querySelector('.settingloadstatus').classList.add("hide");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });

}

function addMemberToProject(member, role, approver) {
    const resetMemberFields = {
        refresh: function(memberFieldReset) {
            inProgressTextStatus(addNewMemberProjBtn, "Add Member to Project", false);
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

    fetch("../addNewProjMember/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ member: member.value, role: role.value, approver: approver.value, proj_id: new_projid, projname: new_projname, logo: logosrc })) })
        .then(data => data.json())
        .then((projmem) => {
            if (projmem.status == "invalid") {
                sessionStorage.clear();
            } else if (projmem.status == "invalidEmail") {
                showAlertBox(`You have entered Invalid Email`, "OK", null, false);
                resetMemberFields.refresh(true);
            } else if (projmem.status == "added") {
                newMemberInsertFields();
                resetMemberFields.refresh(false);
                localStorage.removeItem("tempProjID");
            } else if (projmem.status && projmem.msg) {
                resetMemberFields.refresh(true);
                showAlertBox(projmem.msg, "OK", null, false);
            }

        }).catch((s) => {
            enableAddNewMember = true;
            inProgressTextStatus(addNewMemberProjBtn, "Add Member to Project", false);
            addNewMemberProjBtn.classList.add("btn");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });
}

function createNewProject() {
    let proj = document.getElementById("displayteamname").value.trim();
    if (!validateProjectName(proj)) {
        enableAddNewMember = true;
        return false;
    }
    inProgressTextStatus(addNewMemberProjBtn, "Adding Project...", true);
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
    fetch("../addNewProject/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ project: projname, logo: logosrc })) })
        .then(data => data.json())
        .then((proj) => {
            if (proj.status == "invalid") {
                sessionStorage.clear();
            }

            if (proj.status == "limitreached") {
                showAlertBox(`You have already reached Maximum limit of ${proj.max} Projects`, "OK", null, false);
                document.getElementById("teamDetailsSection").classList.add("hide");
            }

            if (proj.status == "duplicate") {
                showAlertBox(`This Project Name is already taken. Please try a different Name`, "OK", null, false);
                document.getElementById("displayteamname").classList.remove("member-fields-disable");
                document.getElementById("displayteamname").removeAttribute("readonly");
                inProgressTextStatus(addNewMemberProjBtn, "Add Project", false);
                addNewMemberProjBtn.classList.add("btn");
                enableAddNewMember = true;
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
                inProgressTextStatus(addNewMemberProjBtn, "Add Member to Project", false);
                addNewMemberProjBtn.classList.add("btn");
                enableAddNewMember = true;
                localStorage.setItem("tempProjID", proj.projid);
            }

        }).catch((s) => {
            enableAddNewMember = true;
            inProgressTextStatus(addNewMemberProjBtn, "Add Member to Project", false);
            addNewMemberProjBtn.classList.add("btn");
            document.getElementById("displayteamname").classList.remove("member-fields-disable");
            document.getElementById("displayteamname").removeAttribute("readonly");
            showAlertBox("Opps! Server is Busy at the moment.", "OK", null, false);

        });
}

function validateProjectName(proj) {
    if (proj == "") {
        showAlertBox("Please enter Name of the Project", "OK", null, false);
        return false;
    }
    if (proj.length < 3) {
        showAlertBox("Project Name is too Small", "OK", null, false);
        return false;
    }
    if (proj.length > 40) {
        showAlertBox("Project Name can not exceed 40 Characters", "OK", null, false);
        return false;
    }
    if (!(/^([a-z0-9]+[a-z0-9\.\s\-_]*)$/i).test(proj)) {
        showAlertBox("Project Name Invalid", "OK", null, false);
        return false;
    }

    return true;
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

function removeEditUserGroups() {
    let editusergroup = document.querySelectorAll(".edituserGroup");
    editusergroup.forEach(group => {
        group.remove();
    })
}

function removeTempProject(pID) {
    fetch("../removeTempProj/", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ proj: pID })) })
        .then(data => data.json())
        .then(function(s) {
            if (s.status == "removed") {
                localStorage.removeItem("tempProjID");
            }
        });
}

userAccField.addEventListener("change", function() {
    if (initAccountVals.type !== userAccField.value) {
        document.querySelector(".tip-info").classList.remove("hide");
        document.getElementById("new_account_txt").innerText = userAccField.value;
        if (userAccField.value == "team" && teamAcRights == "none") {
            showAlertBox("Business Account lets you create Multiple projects. You must have Full Membership to use Business Account. Please contact 'billvault@zohomail.in' to get Full Membership account details", "OK", null, false);
        }

    } else {
        document.querySelector(".tip-info").classList.add("hide");
    }
});


myProjectSelect.addEventListener("change", function() {
    if (myProjectSelect.value != selectedProjectID) {
        initAccountVals.projchange = true;
        editProjectBtn.classList.add("hide");
        document.getElementById("modifyProjectMembers").classList.add("hide");
        document.querySelector(".user_role").classList.add("hide");
        editProjectMode = false;
        removeEditUserGroups();
    } else {
        initAccountVals.projchange = false;
        document.querySelector(".user_role").classList.remove("hide");
        if (projectMemberRole !== "member") {
            editProjectBtn.classList.remove("hide");
        }
    }

})

userSettingLink.addEventListener("click", function() {
    if (document.getElementById("teamSettingsPage")) {
        document.getElementById("teamSettingsPage").classList.add("hide");
    }
    document.getElementById("userSettingsPage").classList.remove("hide");
    document.getElementById("userSettingsPage").appendChild(saveCloseSetting);
});

teamSettingLink.addEventListener("click", function() {
    document.getElementById("userSettingsPage").classList.add("hide");
    document.getElementById("teamSettingsPage").classList.remove("hide");
    document.getElementById("teamSettingsPage").appendChild(saveCloseSetting);
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
    if (!newMemberPanel && (teamAcRights == "all" || globalAdminRight)) {
        createNewProject();
    } else {
        document.getElementById("addUserPanel").classList.remove("hide");
        let nodes = document.querySelectorAll(".newuserGroup");
        let lastGroup = nodes[nodes.length - 1];
        let memb_email = lastGroup.querySelector(".member-email-field");
        let memb_roles = lastGroup.querySelector(".select-roles-control");
        let appr_email = lastGroup.querySelector(".approver-email-field");

        if (memb_email.value.trim() == "" || appr_email.value.trim() == "") {
            showAlertBox("Please enter Email", "OK", null, false);
            enableAddNewMember = true;
            return;
        }

        if (memb_email.value.trim() == appr_email.value.trim()) {
            appr_email.value = "";
            enableAddNewMember = true;
            showAlertBox("Approver's Email must not be the same", "OK", null, false);
            return;
        }


        if (memb_roles.value == "none") {
            showAlertBox("Please select a role", "OK", null, false);
            enableAddNewMember = true;
            return;
        }

        memb_roles.disabled = true;
        memb_email.setAttribute("readonly", true);
        appr_email.setAttribute("readonly", true);
        memb_email.classList.add("member-fields-disable");
        appr_email.classList.add("member-fields-disable");
        memb_roles.classList.add("member-fields-disable");
        addNewMemberProjBtn.classList.remove("btn");
        inProgressTextStatus(addNewMemberProjBtn, "Adding...", true);
        addMemberToProject(memb_email, memb_roles, appr_email);
    }

});


closesettingsBtn.addEventListener("click", function() {
    settingsBlock.classList.add("hide");
    mainContainer.classList.remove("settingMode");
    settingsBtn.classList.remove("nav-selected");
    if (remPreviousActiveTab == "bills") {
        billshomeBtn.classList.add("nav-selected");
        document.querySelector("title").innerText = "Bill Vault";
    }
    if (remPreviousActiveTab == "charts") {
        chartsBtn.classList.add("nav-selected");
        document.querySelector("title").innerText = "Chart | Bill Vault";
    }
    currentPage = remPreviousActiveTab;

});




//-------------------------------------------------------------------------
//              CHARTS PAGE
//-------------------------------------------------------------------------



/*let piechartdata = [1075
    ['Task', 'Hours per Day'],
    ['Fuel', 250],
    ['Entertainment', 10752],
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

const chartsBlock = document.getElementById("chartsBlock");
const chartsBtn = document.getElementById("charts");
const chartsFilterSelect = document.getElementById("chartdaysFilter");
let all_chart_data = [];

function drawBillsChart(chartElem, chartdata, title, stacked) {
    const charts = {
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
        mainContainer.classList.remove("settingMode");
        activeNavTab(chartsBtn);
        preloader.classList.remove("hide");
        hideElements([settingsBlock, chartsBlock, billThumbNails, previewBillImage, billTable, imageUploader, uncategorisedBtn, uncategorisedMainPanel]);
        document.getElementById("mybillORall").style.display = "none";
        document.querySelector("title").innerText = "Chart | Bill Vault";
        loadCharts();
    }
});



function loadCharts() {
    let type = sessionStorage.getItem("is_private_team") || "private";
    fetch("../chartsload/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ persTeam: type })) })
        .then(data => data.json())
        .then(function(c) {
            if (c.status == "done") {
                preloader.classList.add("hide");
                const bData = JSON.parse(atob(c.chartdata));
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
                if (userAcType == "team") {
                    if (projectMemberRole != "member") {
                        document.getElementById("mybillORall").style.display = "block";
                    }
                    if (type == "team") {
                        teamOrMyBills.innerText = "Show only My Chart";
                    } else {
                        teamOrMyBills.innerText = (projectMemberRole == "admin") ? "Show Team's Charts" : "Show my Reportees Charts";
                    }
                }

                if (all_chart_data.length > 0) {
                    document.getElementById("chartsBlock").classList.remove("hide");
                    filterChart(7);
                } else {
                    showAlertBox("No Chart Data", "OK", null, false);
                }

            }

        });
}



function filterChart(days) {
    //console.log(all_chart_data);
    let pieChartList = all_chart_data.slice(0);
    let markerPoint = 0;
    let todate1 = pieChartList[0].date;
    let fromdate1 = "";
    pieChartList = pieChartList.filter((dx, p) => {
        let tot_days = dateDifference(pieChartList[0].date, dx.date);
        if (tot_days <= days) {
            markerPoint = p;
            fromdate1 = dx.date;
        }
        return tot_days <= days;
    });
    let categories_pie = calculatedTotals(pieChartList);
    let barChartList1 = null;
    let barChartList1Filter = null;
    let categories_bar1 = null;
    let fromdate2 = "";
    let todate2 = "";
    if (days >= 60) {
        barChartList1 = all_chart_data.slice(0);
        barChartList1 = barChartList1.splice(markerPoint + 1);
        todate2 = barChartList1.length > 0 ? barChartList1[0].date : "";
        barChartList1Filter = barChartList1.filter((dx, p) => {
            let tot_days = dateDifference(barChartList1[0].date, dx.date);
            if (tot_days <= 30) {
                markerPoint = p;
                fromdate2 = dx.date;
            }
            return tot_days <= days;
        });
        categories_bar1 = calculatedTotals(barChartList1Filter);
    }


    let barChartList2Filter = null;
    let categories_bar2 = null;
    let fromdate3 = "";
    let todate3 = "";
    if (days == 90) {
        barChartList2Filter = barChartList1.splice(markerPoint + 1);
        todate3 = barChartList2Filter.length > 0 ? barChartList2Filter[0].date : "";
        barChartList2Filter = barChartList2Filter.filter((dx, p) => {
            let tot_days = dateDifference(barChartList2Filter[0].date, dx.date);
            if (tot_days <= 30) {
                fromdate3 = dx.date;
            }
            return tot_days <= 30;
        });
        categories_bar2 = calculatedTotals(barChartList2Filter);
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







//-------------------------------------------------------------------------
//          COMMON CONTROLS
//-------------------------------------------------------------------------

const mainContainer = document.querySelector(".container");
const header_layout = document.querySelector("header img");
const preloader = document.querySelector(".lds-roller");
const themechooser = document.getElementById("themechooser");
const alertBoxWindow = document.getElementById("alertBoxWindow");
const confirmAmountWindow = document.getElementById("confirmAmountWindow");
const mainStatusOK = document.getElementById("mainStatusOK");
const mainStatusCancel = document.getElementById("mainStatusCancel");
const mainStatusMsg = document.querySelector("#alertBoxWindow h4");
const logOutBtn = document.getElementById("logout");

let themeChanged = false;
let themeTrackInterval;
let themeName = localStorage.getItem("theme") || "";
if (themeName != "") {
    document.querySelector("body").setAttribute("class", themeName);
}

themechooser.addEventListener("click", function() {
    themeChanged = true;
    let totalThemes = mainContainer.getAttribute("data-themes");
    let maxThemes = Number(totalThemes);
    let bodyElt = document.querySelector("body");
    let bodyclass = bodyElt.getAttribute("class");
    clearInterval(themeTrackInterval);
    themeTrackInterval = setInterval(themeUpdateTracker, 5000);
    if (!bodyclass || bodyclass.indexOf("skin") == -1) {
        bodyElt.classList.add("skin1");
        themeName = "skin1";
    } else {
        let skinNum = Number(bodyclass.split("skin")[1]);
        if (skinNum < maxThemes) {
            skinNum++;
            bodyElt.setAttribute("class", "skin" + skinNum);
            themeName = "skin" + skinNum;
        } else {
            bodyclass = bodyElt.setAttribute("class", "");
            themeName = "";
        }
    }

});


function inProgressTextStatus(elm, text, inProgress) {
    elm.innerText = text;
    if (inProgress) {
        elm.classList.add("processing-state");
    } else {
        elm.classList.remove("processing-state");
    }
}

function themeUpdateTracker() {
    if (themeChanged) {
        themeChanged = false;
        showAlertBox("Do you want to make this your default Theme color?", "Yes", "No", true, saveTheme, null, null, null);
    }
}

function saveTheme() {
    fetch("../saveDefaultTheme/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyParams({ theme: themeName })) })
        .then(dat => dat.json())
        .then(() => {
            showAlertBox("Default Theme Saved!", "OK", null, false);
            localStorage.setItem("theme", themeName);
        }).catch(function(s) {
            console.log("theme failed");
        });

}


header_layout.addEventListener("click", function() {
    let containerdiv = document.querySelector(".container");
    if (containerdiv.getAttribute("class").includes("topfloater")) {
        // for devices smaller than 375px width, do not remove topfloater class in Settings Mode
        if (window.innerWidth > 375) {
            containerdiv.classList.remove("topfloater")
        } else {
            let settingmodeclass = containerdiv.getAttribute("class");
            if (settingmodeclass.indexOf("settingMode") == -1) {
                containerdiv.classList.remove("topfloater")
            }
        }
    } else {
        containerdiv.classList.add("topfloater")
    }

});



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
    if (oktext == "") {
        mainStatusOK.classList.add("hide");
    }
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

function ConfirmAmountBox(amountList) {
    confirmAmountWindow.classList.remove("hide");
    let chooseAmt = document.getElementById("chooseAmount");
    chooseAmt.innerHTML = "";
    amountList.forEach((amt) => {
        let span = document.createElement("span");
        span.innerText = "Rs." + Math.round(amt);
        span.className = "pick-amount";
        chooseAmt.appendChild(span);
        span.addEventListener("click", function(ev) {
            document.getElementById("amount_field").value = "Rs " + ev.currentTarget.innerText.split("Rs.")[1];
            confirmAmountWindow.classList.add("hide");

        });

    });
}


function hideElements(elements) {
    elements.forEach(elm => {
        elm.classList.add("hide")
    });
}

function showElements(elements) {
    elements.forEach(elm => {
        elm.classList.remove("hide")
    });
}

function activeNavTab(elm) {
    chartsBtn.classList.remove("nav-selected");
    settingsBtn.classList.remove("nav-selected");
    billshomeBtn.classList.remove("nav-selected");
    elm.classList.add("nav-selected");
}



function initLoad() {
    billshomeBtn.click();
    $("#date_field").datepicker({ dateFormat: "dd/mm/yy" });
    let temp_projid = localStorage.getItem("tempProjID") || "";
    if (temp_projid !== "") { removeTempProject(temp_projid) }
    let accountchangeUser = localStorage.getItem("accountchange") || "";
    let projectchangeUser = localStorage.getItem("projectchange") || "";
    let projectmodifyUser = localStorage.getItem("projectmodify") || "";
    if (accountchangeUser != "") {
        localStorage.removeItem("accountchange");
        let atype = accountchangeUser == "team" ? "Business Account" : "Personal Account";
        let logmsg = "You are now logged into your " + atype;
        showAlertBox(logmsg, "OK", null, false);
    } else if (projectchangeUser == "yes") {
        localStorage.removeItem("projectchange");
        showAlertBox("Project Changed Successfuly", "OK", null, false);
    } else if (projectmodifyUser == "yes") {
        localStorage.removeItem("projectmodify");
        showAlertBox("Project Updated", "OK", null, false);
    }
}


let initAuthState = sessionStorage.getItem("initAuth") || "";
if (initAuthState == "") {
    user_validate().then((status) => {
        if (status == "valid") {
            sessionStorage.setItem("initAuth", "done");
            initLoad();
        }
    }).catch(() => {
        sessionStorage.clear();
        location.replace("/")
    })
}
if (initAuthState == "done") {
    initLoad();
}


logOutBtn.addEventListener("click", function() {
    sessionStorage.clear();
    location.replace("/")
});

/*
if(location.href.includes("experimental")){
    document.getElementById("billImageFile").setAttribute("multiple","multiple")
}*/

window.addEventListener("resize", function() {
    document.querySelector(".content-box").style.minheight = (window.innerHeight - document.querySelector("header").offsetHeight) + "px"
})

document.querySelector(".content-box").style.minHeight = (window.innerHeight - document.querySelector("header").offsetHeight) + "px"