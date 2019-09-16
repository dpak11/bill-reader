let form = document.getElementById('myform');
//get the captured media file
let input = document.getElementById('capture');


input.addEventListener('change', () => {
    //console.dir(input.files[0]);
    if (input.files[0].type.indexOf("image/") > -1) {
        let img = document.getElementById('img');
        //img.src = window.URL.createObjectURL(input.files[0]);*/


        // let formData = new FormData();
        //formData.append('bill', img.src); // multipart/form-data

        let fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            let srcData = fileLoadedEvent.target.result; // <--- data: base64
           //let srcData = "public/fuel.png";
            console.log("Init processing...." + srcData );
            //let newImage = document.createElement('img');
            img.src = srcData;

            fetch("../processimage/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myimg: srcData }) })
                .then(data => data.json())
                .then(function(json) {
                    console.log(json.status);
                }).catch(function(s) {
                    console.log("fetch API failed");

                });

            //document.getElementById("imgTest").innerHTML = newImage.outerHTML;
            //alert("Converted Base64 version is " + document.getElementById("imgTest").innerHTML);
            //console.log("Converted Base64 version is " + document.getElementById("imgTest").innerHTML);
        }
        fileReader.readAsDataURL(input.files[0]);

    } else if (input.files[0].type.indexOf("audio/") > -1) {
        alert("Expecting an Image file")
    } else if (input.files[0].type.indexOf("video/") > -1) {
        alert("Expecting an Image file")
    }

});