function createDownloadButton(targetNode, callback) {
    var downloadButton = document.createElement('button');
    downloadButton.innerText = 'Download 3D Model';
    downloadButton.classList.add('download-3d-model');
    downloadButton.style.position = 'absolute';
    downloadButton.style.zIndex = '100';
    downloadButton.style.top = '10px';
    downloadButton.style.right = '10px';
    downloadButton.style.padding = '10px';
    downloadButton.style.backgroundColor = '#4CAF50';
    downloadButton.style.color = 'white';
    downloadButton.style.border = 'none';
    downloadButton.style.borderRadius = '5px';
    downloadButton.style.cursor = 'pointer';

    targetNode.appendChild(downloadButton);

    downloadButton.addEventListener('click', function() {
        callback();
    });
}

function extractTexturePaths(mtlContent) {
    const texturePaths = [];
    const lines = mtlContent.split('\n');
    lines.forEach(line => {
        if (line.startsWith('map_Kd')) {
             // Assumes the path is always after 'map_Kd'
            const path = line.split(' ')[1];
            if (path) texturePaths.push(path);
        }
    });
    return texturePaths;
}

function findObjLoaderScript() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        if (script.textContent.includes('THREE.OBJLoader')) {
            const objPathMatch = script.textContent.match(/objLoader\.load\(\s*'([^']+)'/);
            if (objPathMatch) {
                return objPathMatch[1];
            }
        }
    }
    return null;
}

function fetchTextureData(url) {
    return fetch(url)
        .then(response => response.blob())
        .catch(error => console.error("Fetching texture failed:", error));
}

function adjustMtlContent(mtlContent, textureUrls) {
    let adjustedMtlContent = '';
    const lines = mtlContent.split('\n');
    lines.forEach(line => {
        if (line.startsWith('map_Kd')) {
            // Extract the filename from the texture URL and replace the line with it
            const filename = line.split(' ').pop().split('/').pop();
            adjustedMtlContent += `map_Kd ${filename}\n`;
        } else {
            adjustedMtlContent += line + '\n';
        }
    });
    return adjustedMtlContent.trim();
}

async function packageAndDownloadModel(objPath, mtlContent, textureUrls) {
    var zip = new JSZip();

    const adjustedMtlContent = adjustMtlContent(mtlContent, textureUrls);
    zip.file("model.mtl", adjustedMtlContent);

    // Fetch and add the OBJ file
    var objResponse = await fetch(objPath);
    var objBlob = await objResponse.blob();
    zip.file("model.obj", objBlob);

    const texturePromises = textureUrls.map(url => {
        const filename = url.substring(url.lastIndexOf('/') + 1);
        return fetchTextureData(url).then(data => {
            zip.file(filename, data, {binary: true});
        });
    });

    await Promise.all(texturePromises);
    zip.generateAsync({type: "blob"})
        .then(content => {
            saveAs(content, "3DModel.zip");
        });
}

function onObjectRenderPanelDetected(targetNode) {
    console.log('ObjectRenderPanel found:', targetNode);

    // Extracts the common identifier, e.g., "id1247f"
    const objectId = targetNode.id.replace('orp', ''); 
    const scriptTagId = `${objectId}_script`;
    const scriptTag = document.getElementById(scriptTagId);
    const mtlTagId = `${objectId}orpmtl`;
    const mtlTag = document.getElementById(mtlTagId);

    if (scriptTag && mtlTag) {
        const objPath = findObjLoaderScript();
        if (objPath) {
            console.log("OBJs File Path:", objPath);
            const mtlContent = mtlTag.textContent || mtlTag.innerText;
            const texturePaths = extractTexturePaths(mtlContent);
            const baseUrl = "https://www.grueneerde.com";
            const fullTextureUrls = texturePaths.map(path => `${baseUrl}${path}`);

            if (!document.querySelector('.download-3d-model')) {
                const downloadCallback = function() {
                    console.log("Initiate download process");
                    packageAndDownloadModel(objPath, mtlContent, fullTextureUrls);
                }
                createDownloadButton(targetNode, downloadCallback);
            }
        }
    }
}

var observer = new MutationObserver(function(mutations, obs) {
    var modelPanel = document.querySelector('.ObjectRenderPanel');
    if (modelPanel) {
        onObjectRenderPanelDetected(modelPanel);
        obs.disconnect();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
