let form = document.getElementById('myform');
let input = document.getElementById('capture');



input.addEventListener('change', () => {
    let staticfile = window.location.href.indexOf("?file=") > 0 ? window.location.href.split("file=")[1] : "";

    if (input.files[0].type.indexOf("image/") > -1) {
        let img = document.getElementById('img');   

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64
            //let srcData = "public/fuel.png";
            console.log("Init processing....\n" + srcData);
            //let newImage = document.createElement('img');
            img.src = srcData;

            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myimg: srcData }) })
                .then(data => data.json())
                .then(function(json) {
                    console.log(json.status);
                }).catch(function(s) {
                    console.log("fetch API failed..");
                    console.log(s)

                });

            //document.getElementById("imgTest").innerHTML = newImage.outerHTML;
            //alert("Converted Base64 version is " + document.getElementById("imgTest").innerHTML);
            //console.log("Converted Base64 version is " + document.getElementById("imgTest").innerHTML);
        }

        if (staticfile != "") {
            fetch(staticfile).then(resp => resp.blob())
            .then(blob => {
                console.log("IMG:"+staticfile);
                fileReader.readAsDataURL(blob);
            })
        }else{
            console.log("IMG:"+input.files[0]);
            fileReader.readAsDataURL(input.files[0]);
        }
        

    } else if (input.files[0].type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (input.files[0].type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

});