const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sharp = require('sharp');
const Jimp = require('jimp');

  /* API made by Mika Rafaralahy.
  For context :
    5512 is not a random number
    It is called dummy due to the fact that it is just some solution to ensure that the red layer is intact
    The chip read two times : 1 for black and white and 1 for white and red
    The total of the data sent shouid be around 10512
    First 5000 is black and white layer
    Second 5000 is red and white layer
    512 is the real dummy one. Those are necessary because the chip do not have exactly 5000 slot per layer, it has 5256 and each image converted using the algorithm generate 5000 units of data, we just complete them using dummy white data
    Those does not interfere with the final result.
*/

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const settings = {
    screenWidth: 200,
    ditheringThreshold: 128,
    addFormatting: true,
    colorThreshold: 50 
};

//From local files
app.post('/convert', async (req, res) => {
    const base64String = req.body.base64String;
    const selectedColorString = req.body.selectedColor.toString();

    let isInverted = 0;
    let imageDataBW = [];
    let imageDataR = [];

    if (!base64String) {
        return res.status(400).json({ error: 'Base64 string is required.' });
    }

    if (!selectedColorString) {
        return res.status(400).json({ error: 'Nail Color theme must be selected.' });
    }

    try {

        //Read the Base64 and Convert it
        const imageBuffer = Buffer.from(base64String, 'base64');

        switch (selectedColorString) {
            case 'Black-White':
                imageDataBW = await convertToBlackWhite(imageBuffer);
                res.json(resolve2Color(imageDataBW));
                break;
            
            //TODO: need more test
            case 'Red-Black':
                imageDataBW = await convertToInvertedBlackWhite(imageBuffer);
                imageDataR = await convertToBlackWhite(imageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break;
            
             //TODO: need more test
            case 'Red-White':
                imageDataBW = await convertToFullWhite(imageBuffer);
                imageDataR = await convertToRedBlackWhite(imageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break;    
            
            case 'Red-Black-White':
                imageDataBW = await convertToBlackWhite(imageBuffer);
                imageDataR = await convertToRedBlackWhite(imageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break; 
            
            default:
                return res.status(500).json({ error: 'Error in Image processing' });
        }
    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

//Plain white selected
app.post('/convert/white', (req, res) => {
    try {
        console.log("Received data white");
        const dummy = "0xff";
        let repeat = "0xff";
        for (let i = 0; i < 10511; i++) {
            repeat += ",";
            repeat += dummy;
        }
        res.json(repeat);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

//Plain black selected
app.post('/convert/black', (req, res) => {
    try {
        console.log("Received data Black");
        const dummy = "0x00,";
        const dummyRed = "0xff,";
        let repeat = "";
        for (let i = 0; i < 5256; i++) {
            repeat += dummy;
        }
        for (let i = 0; i < 5255; i++) {
            repeat += dummyRed;
        }
        repeat += "0xff";
        res.json(repeat);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
  
//Plain red selected
app.post('/convert/red', (req, res) => {
    try {
        console.log("Received data Black");
        const dummy = "0xff,";
        const dummyRed = "0x00,";
        let repeat = "";
        for (let i = 0; i < 5256; i++) {
            repeat += dummy;
        }
        for (let i = 0; i < 5255; i++) {
            repeat += dummyRed;
        }
        repeat += "0x00";
        res.json(repeat);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});
  
//Image from external sources like website or links
app.post('/convert/External', async (req, res) => {
    const imageUrl = req.body.image;
    const selectedColor = req.body.selectedColor.toString();

    let imageDataBW = [];
    let imageDataR = [];
    try {
        

        console.log("API selected color : " + selectedColor);
    // Fetch image data from URL
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
  
    // Process image if needed (e.g., resize, convert format)
    const processedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 200, height: 200 }) // Example resizing
        .jpeg() // Example converting to JPEG format
        .toBuffer();
  
    // Send the processed image buffer as a response
        res.set('Content-Type', 'image/jpeg'); // Set appropriate content type
        
        switch (selectedColor) {
            case 'Black-White':
                imageDataBW = await convertToBlackWhite(processedImageBuffer);
                res.json(resolve2Color(imageDataBW));
                break;
            
            //TODO: need more test
            case 'Red-Black':
                imageDataBW = await convertToInvertedBlackWhite(processedImageBuffer);
                imageDataR = await convertToBlackWhite(processedImageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break;
            
             //TODO: need more test
            case 'Red-White':
                imageDataBW = await convertToFullWhite(processedImageBuffer);
                imageDataR = await convertToRedBlackWhite(processedImageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break;    
            
            case 'Red-Black-White':
                imageDataBW = await convertToBlackWhite(processedImageBuffer);
                imageDataR = await convertToRedBlackWhite(processedImageBuffer);
                res.json(resolve3Color(imageDataBW, imageDataR));
                break; 
            
            default:
                return res.status(500).json({ error: 'Error in Image processing' });
        }
    

    //const imageDat = await convertToBlackWhite(processedImageBuffer);
        
    //res.json(resolve2Color(imageDat));
    } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).send('Internal Server Error');
    }
  });

// Resolve 3 color 
function resolve3Color(imageDataBW, imageDataRed) {
    let repeat = "";
    const dummy = "0xff,";
    let codeBlack = horizontal1bitBlackWhite(imageDataBW, settings.screenWidth);
    let codeRed = horizontal1bitBlackWhite(imageDataRed, settings.screenWidth);

    for (let i = 0; i < 256; i++) {
        repeat += dummy;
    }
    const outputString = `${codeBlack + repeat + codeRed + repeat}`;
    return outputString;
    
}

// Resolve 2 color 
function resolve2Color(imageDataBW) {
    let repeat = "";
    let codeBlack = horizontal1bitBlackWhite(imageDataBW, settings.screenWidth);
    const dummy = "0xff,";
    for (let i = 0; i < 5512; i++) {
        repeat += dummy;
    }
    const outputString = `${codeBlack + repeat}`;
    return outputString;
}

//Main conversion function to arduino format
function horizontal1bitBlackWhite(data, canvasWidth) {
    let stringFromBytes = '';
    let byteIndex = 7;
    let number = 0;
    let outputIndex = 0;

    for (let index = 0; index < data.length; index++) {
        const avg = data[index];
        if (avg > settings.ditheringThreshold) {
            number += 2 ** byteIndex;
        }
        byteIndex--;

        if (index !== 0 && ((index + 1) % canvasWidth === 0) || index === data.length - 1) {
            byteIndex = -1;
        }

        if (byteIndex < 0) {
            let byteSet = bitswap(number).toString(16);
            if (byteSet.length === 1) { byteSet = `0${byteSet}`; }

            if (settings.addFormatting) {
                stringFromBytes += `0x${byteSet}, `;
                outputIndex++;

                if (outputIndex >= 16) {
                    stringFromBytes += '';
                    outputIndex = 0;
                }
            } else {
                stringFromBytes += byteSet;
            }

            number = 0;
            byteIndex = 7;
        }
    }

    return stringFromBytes;
}

//Some calibration
function bitswap(b) {
    if (settings.bitswap) {
        b = (b & 0xF0) >> 4 | (b & 0x0F) << 4;
        b = (b & 0xCC) >> 2 | (b & 0x33) << 2;
        b = (b & 0xAA) >> 1 | (b & 0x55) << 1;
    }

    return b;
}

//Binary black and white.
//If we need to add more variant. we just to calibrate here
function convertToBlackWhite(buffer) {
    return new Promise((resolve, reject) => {
        Jimp.read(buffer, (err, image) => {
            if (err) {
                return reject(err);
            }

            const imageData = [];

            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const red = image.bitmap.data[idx];
                const green = image.bitmap.data[idx + 1];
                const blue = image.bitmap.data[idx + 2];
                const avg = (red + green + blue) / 3;
                const binaryValue = avg > settings.ditheringThreshold ? 255 : 0;
                imageData.push(binaryValue);
            });

            resolve(imageData);
        });
    });
}

//Full white
function convertToFullWhite(buffer) {
    return new Promise((resolve, reject) => {
        Jimp.read(buffer, (err, image) => {
            if (err) {
                return reject(err);
            }
            const imageData = [];
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const binaryValue =  255;
                imageData.push(binaryValue);
            });

            resolve(imageData);
        });
    });
}

//Full Black
function convertToFullBlack(buffer) {
    return new Promise((resolve, reject) => {
        Jimp.read(buffer, (err, image) => {
            if (err) {
                return reject(err);
            }
            const imageData = [];
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const binaryValue =  0;
                imageData.push(binaryValue);
            });

            resolve(imageData);
        });
    });
}

//Inverted Black And White
function convertToInvertedBlackWhite(buffer) {
    return new Promise((resolve, reject) => {
        Jimp.read(buffer, (err, image) => {
            if (err) {
                return reject(err);
            }

            const imageData = [];

            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const red = image.bitmap.data[idx];
                const green = image.bitmap.data[idx + 1];
                const blue = image.bitmap.data[idx + 2];
                const avg = (red + green + blue) / 3;
                const binaryValue = avg > settings.ditheringThreshold ? 0 : 255;
                imageData.push(binaryValue);
            });

            resolve(imageData);
        });
    });
}

function convertToRedBlackWhite(buffer) {
    return new Promise((resolve, reject) => {
        Jimp.read(buffer, (err, image) => {
            if (err) {
                reject(err);
                return;
            }

            const imageData = [];

            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const red = image.bitmap.data[idx];
                const green = image.bitmap.data[idx + 1];
                const blue = image.bitmap.data[idx + 2];
                const isRedDominant = red > green && red > blue && (red - Math.max(green, blue) > settings.colorThreshold);

                // Assign white (255) if not dominantly red, otherwise assign a specific value to represent red
                // Assuming 0 for red for simplicity, but you may need to adjust based on how you're encoding colors
                const colorValue = isRedDominant ? 0 : 255;
                imageData.push(colorValue);
            });
            resolve(imageData);
        });
    });
}


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
