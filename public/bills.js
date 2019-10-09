let captureImg = document.getElementById('captureImg');
let fileImg = document.getElementById('fileImg');
let allBillsData = null;
let billsObjRef = {};
let billMode = "save";

let billshomeBtn = document.getElementById("billshome");
let saveBillBtn = document.getElementById("savebill");
let deleteBillBtn = document.getElementById("deletebill");
let exitBillBtn = document.getElementById("exitbill");
let updateBillBtn = document.getElementById("updatebill");


captureImg.addEventListener('change', () => {
    imageProcess(captureImg.files[0]);

});

fileImg.addEventListener('change', () => {
    imageProcess(fileImg.files[0]);

});


function imageProcess(imgfile) {
    if (imgfile.type.indexOf("image/") > -1) {
        let img = document.querySelector('.previewimg img');
        document.querySelector('.lds-roller').classList.remove("hide");

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64            
            console.log("Init processing....\n" + srcData);
            img.src = srcData;
            document.querySelector('.lds-roller').classList.remove("hide");

            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ img: srcData }) })
                .then(data => data.json())
                .then(function(json) {
                    document.querySelector(".lds-roller").classList.add("hide");
                    exitBillBtn.classList.remove("hide");
                    deleteBillBtn.classList.add("hide");
                    displayBillingTable(json.status);
                    billMode = "save";
                }).catch(function(s) {
                    console.log("fetch API failed..");
                    console.log(s);
                    document.querySelector(".lds-roller").classList.add("hide");
                });
        }
        fileReader.readAsDataURL(imgfile);

    } else if (imgfile.type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (imgfile.type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
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
            saveBillBtn.classList.add("hide");
            updateBillBtn.classList.remove("hide");
            exitBillBtn.classList.remove("hide");
            deleteBillBtn.classList.remove("hide");
            let values = ev.currentTarget.getAttribute("data-billvals");
            let idval = ev.currentTarget.getAttribute("id").split("mb_")[1];
            displayBillingTable(JSON.parse(atob(values)));
            document.querySelector('.previewimg img').setAttribute("src", billsObjRef[idval]);
        })
    });

}

function fetchBills() {
    let client = sessionStorage.getItem("ckey") || false;
    let serv = sessionStorage.getItem("skey") || false;
    let sessionemail = sessionStorage.getItem("em") || false;
    if (client && serv && sessionemail) {
        return fetch("../loadBills/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(sessionemail), agent: btoa(navigator.userAgent), key_serv: serv }) })
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
                sessionStorage.clear();
                document.querySelector('.lds-roller').classList.add("hide");
            });
    }
}

function saveBill(bill, email, serv) {
    return fetch("../saveBill/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ em: atob(email), agent: btoa(navigator.userAgent), key_serv: serv, receipt: bill }) })
        .then(data => data.json())
        .then(function(res) {
            if (res.status == "invalid") {
                sessionStorage.clear();
                saveBillBtn.innerText = "Save";
                saveBillBtn.classList.remove("saving-state");
                deleteBillBtn.classList.remove("hide");
                exitBillBtn.classList.remove("hide");
                document.querySelector('.lds-roller').classList.add("hide");
            }
            if (res.status == "saved") {
                deleteBillBtn.click();
                saveBillBtn.innerText = "Save";
                saveBillBtn.classList.remove("saving-state");
                deleteBillBtn.classList.remove("hide");
                exitBillBtn.classList.remove("hide");

            }
        }).catch(function() {
            sessionStorage.clear();
            document.querySelector('.lds-roller').classList.add("hide");
            saveBillBtn.innerText = "Save";
            saveBillBtn.classList.remove("saving-state");
            deleteBillBtn.classList.remove("hide");
            exitBillBtn.classList.remove("hide");
        });
}

function updateBill() {
    const client = sessionStorage.getItem("ckey");
    const serv = sessionStorage.getItem("skey");
    const sessionemail = sessionStorage.getItem("em");
    const billID = Object.keys(billsObjRef)[0];
    console.log(billsObjRef[billID]);
    console.log("Bill Update");
}

function deleteBill() {

}



billshomeBtn.addEventListener("click", function() {
    fetchBills();
    document.querySelector('.lds-roller').classList.remove("hide");
    billshome.classList.add("nav-selected");

});

saveBillBtn.addEventListener("click", function() {
    const date = document.getElementById("date_field").value;
    const merchant = document.getElementById("merchant_field").value;
    const amt = document.getElementById("amount_field").value;
    const descr = document.getElementById("descr_field").value;
    const billType = document.getElementById("billtype").value;

    let billdata = { date: date, title: merchant, total: amt, descr: descr, type: billType };
    let client = sessionStorage.getItem("ckey") || "";
    let serv = sessionStorage.getItem("skey") || "";
    let sessEmail = sessionStorage.getItem("em") || "";
    let imgSrc = document.querySelector('.previewimg img').getAttribute("src");
    let billObj = {
        bill: encryptImg(imgSrc, { serv: serv, cli: client }),
        billFields: encryptData(billdata, { serv: serv, cli: client })
    }
    console.log(billObj);
    document.querySelector('.lds-roller').classList.remove("hide");
    saveBillBtn.innerText = "Saving...";
    saveBillBtn.classList.add("saving-state");
    deleteBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
    saveBill(billObj, sessEmail, serv);
});



updateBillBtn.addEventListener("click", function() {
    updateBillBtn.innerText = "Updating...";
    updateBillBtn.classList.add("saving-state");
    deleteBillBtn.classList.add("hide");
    exitBillBtn.classList.add("hide");
    updateBill();
});

deleteBillBtn.addEventListener("click", function() {
    exitBillBtn.click();
    if (billMode == "update") {
        deleteBill();
    }
});

exitBillBtn.addEventListener("click", function() {
    document.getElementById("billTable").classList.add("hide");
    document.getElementById("date_field").value = "";
    document.getElementById("merchant_field").value = "";
    document.getElementById("amount_field").value = "";
    document.querySelector('.previewimg img').setAttribute("src", "");
    document.querySelector('.lds-roller').classList.add("hide");
    document.querySelector('.previewimg').classList.add("hide");
    if (billMode == "update") {
        document.getElementById("imageuploader").classList.remove("hide");
        billMode = "save";
    }

});