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

function getCryptVals(encr) {
    let enckey = `${encr.serv}${encr.cli}`;
    let cli_key = encr.cli;
    let chars = "zxcvbnmlkjhgfdsaqwertyiopuQWERTYUIOPLKJHGFDSAZXCVBNM0123456789+=/";
    let totalextract = 0;

    let allchars = [...enckey.split(""), ...chars.split("")];
    let uniqueKey = new Set(allchars);
    let uKey = [...uniqueKey];
    console.log("Unique key:" + uKey.join(""));
    for (let i = 0; i < cli_key.length; i++) {
        totalextract = totalextract + uKey.indexOf(cli_key.substr(i, 1));
    }

    let minDivideBlocks = uKey.indexOf(cli_key.substr(0, 1));
    minDivideBlocks = minDivideBlocks > 30 ? 30 : minDivideBlocks < 5 ? 5 : minDivideBlocks;
    let extractPos = uKey.indexOf(cli_key.substr(1, 1));
    let fromClient1 = cli_key.substr(-3);
    let partitionStr1 = `${fromClient1.charCodeAt(0)}${fromClient1.charCodeAt(1)}${fromClient1.charCodeAt(2)}`;
    partitionStr1 = btoa(partitionStr1);
    let fromClient2 = cli_key.substr(Math.floor(cli_key.length / 2), 3);
    let partitionStr2 = `${fromClient2.charCodeAt(0)}${fromClient2.charCodeAt(1)}${fromClient2.charCodeAt(2)}`;
    partitionStr2 = btoa(partitionStr2);
    let partitionStr = [partitionStr1, partitionStr2, partitionStr1.split("").reverse().join(""), partitionStr2.split("").reverse().join("")];

    return {
        totalExtr: totalextract,
        divBlocks: minDivideBlocks,
        position: extractPos,
        partition: partitionStr
    };
}



function encryptImg(_imgdata, enc_key) {
    let cryptoVals = getCryptVals(enc_key);
    console.log(cryptoVals);
    let img_data = _imgdata.split(";base64,");
    let imgdata = img_data[1];
    let imgBlocks = Math.ceil(imgdata.length / cryptoVals.divBlocks);
    let imgBlockList = [];
    for (let b = 0; b < cryptoVals.divBlocks; b++) {
        let cutPoint = b * imgBlocks;
        imgBlockList.push(imgdata.substr(cutPoint, imgBlocks));
    }


    let extractedBlocks = [];
    let encrypted = ``;
    imgBlockList.forEach(function(item) {
        let substr = item.substr(cryptoVals.position, cryptoVals.totalExtr);
        let parts = item.split(substr);
        let partitioner = cryptoVals.partition[Math.floor(Math.random() * 4)];
        encrypted = `${encrypted}${parts[0]}${parts[1]}${partitioner}`;
        extractedBlocks.push(substr);
    });
    let base = `${img_data[0]};base64,`;
    return `${encrypted}${extractedBlocks.join("")}__${btoa(base)}`;
}



function decryptImg(encryptedImg, enc_key) {
    let cryptoVals = getCryptVals(enc_key);
    console.log(cryptoVals);
    let splitter = encryptedImg.split("__");
    let base = atob(splitter[1]);
    let blocks = splitPartition(cryptoVals.partition, splitter[0]);
    let extractedSeq = blocks.pop();
    let decrypted = ``;
    blocks.forEach(function(part, i) {
        let extract = extractedSeq.substr(i * cryptoVals.totalExtr, cryptoVals.totalExtr);
        decrypted = `${decrypted}${part.substr(0,cryptoVals.position)}${extract}${part.substr(cryptoVals.position)}`
    })
    return `${base}${decrypted}`;

}

function splitPartition(p, str) {
    let string = str;
    for (let i in p) {
        let pattern = new RegExp(p[i], "g");
        string = string.replace(pattern, "||");
    }
    return string.split("||");
}

function encryptData(data, enc_key) {
    // base64(data): 78hfslt84ogjsndkfdsuif894
    // Add count to charcode  = cryptoVals.position + cryptoVals.divBlocks
    // Position to insert = cryptoVals.totalExtr
    let cryptoVals = getCryptVals(enc_key);
    let encData = btoa(JSON.stringify(data));
    let dataCharEnc = ``;
    for (let i = 0; i < encData.length; i++) {
        let increment = encData.charCodeAt(i) + cryptoVals.divBlocks + cryptoVals.position;
        dataCharEnc = `${dataCharEnc}${increment}_`;
    }
    encData = btoa(dataCharEnc);
    let randomNum = Math.round(Math.random() * 150) + 500;
    let str = "qwertyuioplkjhgfdsazxcvbnmQWERTYUIOPLKJHGFDSAZXCVBNM1234567890";
    let randomStr = ``;
    for (var j = 0; j < randomNum; j++) {
        randomStr = `${randomStr}${str.substr(Math.floor(Math.random()*str.length),1)}`;
    }
    let insertPosition = cryptoVals.totalExtr;
    insertPosition = insertPosition >= (randomStr.length - 2) ? randomStr.length - cryptoVals.divBlocks : insertPosition;

    let str_ins_pos = extractValsConvert(enc_key, String(insertPosition), false);
    let enc_len = extractValsConvert(enc_key, String(encData.length), false);

    let obj = btoa(JSON.stringify({ a: str_ins_pos, b: enc_len }));
    let partitioner = cryptoVals.partition[Math.floor(Math.random() * 4)];
    return `${randomStr.substr(0,insertPosition)}${encData}${randomStr.substr(insertPosition)}${partitioner}${obj}`;
    

}

function decryptData(encr_data, enc_key) {
    let cryptoVals = getCryptVals(enc_key);
    let enckey = `${enc_key.cli}${enc_key.serv}`;
    let dataset = null;
    let partitionStr = encr_data.indexOf(cryptoVals.partition[0]) > 1 ? cryptoVals.partition[0] :
        encr_data.indexOf(cryptoVals.partition[1]) > 1 ? cryptoVals.partition[1] :
        encr_data.indexOf(cryptoVals.partition[2]) > 1 ? cryptoVals.partition[2] :
        encr_data.indexOf(cryptoVals.partition[3]) > 1 ? cryptoVals.partition[3] : "";
    if (partitionStr != "") {
        dataset = encr_data.split(partitionStr)
        if (dataset.length == 2) {
            let extractVals = JSON.parse(atob(dataset[1]));
            let extrFromPos = extractValsConvert(enc_key, extractVals.a, true);
            let size = extractValsConvert(enc_key, extractVals.b, true);
            let data = atob(dataset[0].substr(extrFromPos,size));
            data = data.substr(0, data.length - 1);
            let dataparts = data.split("_");
            dataparts = dataparts.map(function(d) {
                return String.fromCharCode(Number(d) - (cryptoVals.divBlocks + cryptoVals.position));
            })
            return JSON.parse(atob(dataparts.join("")));
        }
    }

}

function extractValsConvert(enc_key, charNums, retreive) {
    let key = `${enc_key.cli}${enc_key.serv}qwertyuioplkjhgfdsazxcvbnmQWERTYUIOPLKJHGFDSAZXCVBNM1234567890`;
    let uniqueKey = new Set(key.split(""));
    let uKey = [...uniqueKey];
    let _c = ``;
    if (!retreive) {
        for (let u = 0; u < charNums.length; u++) {
            _c = `${_c}${uKey[Number(charNums.substr(u,1))]}`;
        }
        return _c;
    } else {
        for (let v = 0; v < charNums.length; v++) {
            _c = `${_c}${uKey.indexOf(charNums.substr(v,1))}`;
        }
        return Number(_c);
    }

}