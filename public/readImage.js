let captureImg = document.getElementById('captureImg');
let fileImg = document.getElementById('fileImg');
let staticfile = window.location.href.indexOf("?file=") > 0 ? window.location.href.split("file=")[1] : "";


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
                    console.log(json.status);
                    document.querySelector('.previewimg').classList.remove("hide");
                    document.querySelector(".lds-roller").classList.add("hide");
                    displayBillingTable(json.status);
                }).catch(function(s) {
                    console.log("fetch API failed..");
                    console.log(s);
                    document.querySelector(".lds-roller").classList.add("hide");
                });
        }

        if (staticfile != "") {
            fetch(staticfile).then(resp => resp.blob())
                .then(blob => {
                    console.log("IMG:" + staticfile);
                    fileReader.readAsDataURL(blob);
                })
        } else {
            console.log("IMG:" + imgfile);
            fileReader.readAsDataURL(imgfile);
        }


    } else if (imgfile.type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (imgfile.type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

}

function displayBillingTable(data) {
    document.getElementById("billTable").classList.remove("hide");
    document.getElementById("date_field").value = data.date || "";
    document.getElementById("merchant_field").value = data.title || "";
    document.getElementById("amount_field").value = data.total || "";


}

function generatePasswordKey(pswd, constEmailCode) {

    let totals = 1;
    let pswdchars = ``;
    let emChars = ``;
    for (let j = 0; j < constEmailCode.length; j++) {
        let char = constEmailCode.substr(j, 1);
        emChars = `${emChars}${constEmailCode.charCodeAt(j)}`;
        if (!isNaN(char)) {
            totals = totals + Number(char)
        }
    }
    
    for (let i = 0; i < pswd.length; i++) {
        let pswdCodeStr = pswd.charCodeAt(i) + totals;
        pswdchars = `${pswdchars}${pswdCodeStr}`;
    }
    
    let min = Math.min(emChars.length, pswdchars.length);
    let loopString = emChars.length == min ? emChars : pswdchars;
    let compareString = emChars.length == min ? pswdchars : emChars;
    let result = ``;

    for (let q = 0; q < min; q++) {
        let val = Math.abs(Number(loopString.substr(q, 1)) - Number(compareString.substr(q, 1)));
        result = `${result}${val}`;
    }

    let encoded = btoa(result);
    let half = Math.ceil(encoded.length / 2);
    return {
        serv: encoded.substr(0, half),
        cli: encoded.substr(half)
    }

}



function encrypt(_imgdata, enc_key) {
    let cryptoVals = getCryptVals(enc_key);
    let img_data = _imgdata.split(";base64,");
    let imgdata = img_data[1];
    let imgBlocks = Math.ceil(imgdata.length / cryptoVals.divBlocks);
    /*console.log(imgBlocks);*/
    let imgBlockList = [];
    for (let b = 0; b < cryptoVals.divBlocks; b++) {
        let cutPoint = b * imgBlocks;
        imgBlockList.push(imgdata.substr(cutPoint, imgBlocks));
    }
    /*console.log(imgBlockList);*/


    let extractedBlocks = [];
    let encrypted = ``;
    imgBlockList.forEach(function(item) {
        let substr = item.substr(cryptoVals.position, cryptoVals.totalExtr);
        let parts = item.split(substr);
        encrypted = `${encrypted}${parts[0]}${parts[1]}${cryptoVals.partition}`;
        extractedBlocks.push(substr);
    });
    let base = `${img_data[0]};base64,`;
    return `${encrypted}${extractedBlocks.join("")}__${btoa(base)}`;
}

function getCryptVals(encr) {
    let enckey = `${encr.serv}${encr.cli}`;
    let cli_key = encr.cli;
    let chars = "zxcvbnmlkjhgfdsaqwertyiopuQWERTYUIOPLKJHGFDSAZXCVBNM0123456789+=/";
    let totalextract = 0;

    // get Uniques from enckey;
    let allchars = [...enckey.split(""), ...chars.split("")];
    let uniqueKey = new Set(allchars);
    let uKey = [...uniqueKey];
    console.log("Unique key:" + uKey.join(""));
    for (let i = 0; i < cli_key.length; i++) {
        totalextract = totalextract + uKey.indexOf(cli_key.substr(i, 1));
    }
    /*console.log("total to extract:" + totalextract);*/
    let minDivideBlocks = uKey.indexOf(cli_key.substr(0, 1));
    minDivideBlocks = minDivideBlocks > 30 ? 30 : minDivideBlocks < 5 ? 5 : minDivideBlocks;
    let extractPos = uKey.indexOf(cli_key.substr(1, 1));
    /*console.log("blocks:" + minDivideBlocks + " = " + cli_key.substr(0, 1));
    console.log("Extr Pos:" + extractPos + " = " + cli_key.substr(1, 1));
*/

    let fromClient = cli_key.substr(-3);
    let partitionStr = `${fromClient.charCodeAt(0)}${fromClient.charCodeAt(1)}${fromClient.charCodeAt(2)}`;
    partitionStr = btoa(partitionStr);


    return { totalExtr: totalextract, divBlocks: minDivideBlocks, position: extractPos, partition: partitionStr }
}

function decrypt(encryptedImg, enc_key) {
    let cryptoVals = getCryptVals(enc_key);
    let splitter = encryptedImg.split("__");
    let base = atob(splitter[1]);
    let blocks = splitter[0].split(cryptoVals.partition);
    let extractedSeq = blocks.pop();
    let decrypted = ``;
    blocks.forEach(function(part, i) {
        let extract = extractedSeq.substr(i * cryptoVals.totalExtr, cryptoVals.totalExtr);
        decrypted = `${decrypted}${part.substr(0,cryptoVals.position)}${extract}${part.substr(cryptoVals.position)}`
    })
    return `${base}${decrypted}`;

}