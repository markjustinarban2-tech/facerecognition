const video = document.getElementById('video');
const statusText = document.getElementById('status');
const registerBtn = document.getElementById('registerBtn');
const attendanceBtn = document.getElementById('attendanceBtn');


async function init() {
    statusText.innerText = "Loading AI Models...";
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('./models/'),
            faceapi.nets.faceLandmark68Net.loadFromUri('./models/'),
            faceapi.nets.faceRecognitionNet.loadFromUri('./models/')
        ]);
        startVideo();
    } catch (e) {
        console.error(e);
        statusText.innerText = "Error loading models. Check your /models folder!";
    }
}


function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            statusText.innerText = "System Ready!";
            registerBtn.disabled = false;
            attendanceBtn.disabled = false;
        })
        .catch(err => statusText.innerText = "Camera Error: " + err);
}


registerBtn.addEventListener('click', async () => {
    const name = prompt("Enter Employee Name:");
    if (!name) return;

    statusText.innerText = "Scanning face...";
    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (detection) {
        
        const faceArray = Array.from(detection.descriptor);
        
        firebase.database().ref('employees/').push({
            name: name,
            faceDescriptor: faceArray,
            dateRegistered: new Date().toISOString()
        });
        
        statusText.innerText = "Employee " + name + " Registered!";
    } else {
        statusText.innerText = "No face detected. Try again!";
    }
});


attendanceBtn.addEventListener('click', async () => {
    statusText.innerText = "Identifying...";
    
    // Get all registered employees from Firebase
    const snapshot = await firebase.database().ref('employees/').once('value');
    const employees = snapshot.val();

    if (!employees) {
        statusText.innerText = "No employees in database!";
        return;
    }

    const liveDetection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

    if (liveDetection) {
        let matchFound = false;
        
        // Loop through Firebase data to find a match
        for (let id in employees) {
            const storedDescriptor = new Float32Array(employees[id].faceDescriptor);
            const distance = faceapi.euclideanDistance(liveDetection.descriptor, storedDescriptor);

            // If distance is less than 0.6, it's the same person!
            if (distance < 0.6) {
                firebase.database().ref('attendance/').push({
                    name: employees[id].name,
                    time: new Date().toLocaleString()
                });
                statusText.innerText = "Welcome, " + employees[id].name + "! Attendance marked.";
                matchFound = true;
                break;
            }
        }
        if (!matchFound) statusText.innerText = "Face not recognized.";
    }
});

init();