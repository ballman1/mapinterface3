// Complete EpiPen Community Map App with Full Functionality

const firebaseConfig = {
  apiKey: "AIzaSyAEqp-BO5SGdoKEB154FfgVsRP0cdaxpAU",
  authDomain: "epipen-finder-map-34982.firebaseapp.com",
  projectId: "epipen-finder-map-34982",
  storageBucket: "epipen-finder-map-34982.firebasestorage.app",
  messagingSenderId: "389714610819",
  appId: "1:389714610819:web:a1a6310b98039d9ab2e9b6",
  measurementId: "G-KZ5PPMNKEQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

auth.signInAnonymously().catch(console.error);

window.initMap = async function () {
  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5
  });

  const iconDefault = "images/epipen_icon_transparent_32x32.png";
  const iconVerified = "images/epipen_icon_transparent_32x32.png"; // use different color/icon if desired

  const snapshot = await db.collection("locations").get();
  for (const doc of snapshot.docs) {
    const data = doc.data();

    const feedbackSnap = await db.collection("locations").doc(doc.id).collection("feedback").get();
    let likes = 0, flags = 0;
    feedbackSnap.forEach(f => {
      if (f.data().type === "like") likes++;
      if (f.data().type === "flag") flags++;
    });

    const marker = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map,
      title: data.name,
      icon: {
        url: data.verifiedByBusiness ? iconVerified : iconDefault,
        scaledSize: new google.maps.Size(32, 32)
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <strong>${data.name}</strong><br>
        ${data.address}<br>
        Type: ${data.type}<br>
        ${data.verifiedByBusiness ? "<span style='color:green'>✅ Verified by the business</span><br>" : ""}
        <button onclick=\"submitFeedback('${doc.id}', 'like')\">👍 Confirm</button>
        <button onclick=\"submitFeedback('${doc.id}', 'flag')\">🚩 Flag</button><br>
        👍 ${likes} | 🚩 ${flags}<br><br>
        ${!data.verifiedByBusiness ? `<a href='mailto:verify@epipenmap.org?subject=Verify My EpiPen Location&body=Name: ${data.name}%0D%0AAddress: ${data.address}'>Request to Verify</a>` : ""}
      `
    });

    marker.addListener("click", () => infoWindow.open(map, marker));
  }

  map.addListener("click", async function (event) {
    const clickedLatLng = event.latLng;
    const confirmTag = window.confirm("Tag this location as having an EpiPen?");
    if (!confirmTag) return;

    const geocode = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${clickedLatLng.lat()},${clickedLatLng.lng()}&key=AIzaSyASHf6jmZTRP_zxWdSbaI205EMmlg-Q0Qc`);
    const data = await geocode.json();

    if (!data.results.length) {
      alert("Could not identify this location.");
      return;
    }

    const result = data.results[0];
    const locationData = {
      name: result.address_components[0]?.long_name || "Unnamed Location",
      type: "community-tagged",
      address: result.formatted_address,
      lat: clickedLatLng.lat(),
      lng: clickedLatLng.lng(),
      submittedAt: new Date(),
      verifiedByBusiness: false
    };

    await db.collection("locations").add(locationData);

    new google.maps.Marker({
      position: clickedLatLng,
      map,
      title: locationData.name,
      icon: {
        url: iconDefault,
        scaledSize: new google.maps.Size(32, 32)
      }
    });

    const confirmation = document.createElement("div");
    confirmation.textContent = "✅ Location tagged successfully!";
    confirmation.style.position = "fixed";
    confirmation.style.top = "20px";
    confirmation.style.left = "50%";
    confirmation.style.transform = "translateX(-50%)";
    confirmation.style.padding = "10px 20px";
    confirmation.style.background = "#4caf50";
    confirmation.style.color = "#fff";
    confirmation.style.borderRadius = "6px";
    confirmation.style.fontWeight = "bold";
    confirmation.style.zIndex = "9999";
    document.body.appendChild(confirmation);
    setTimeout(() => confirmation.remove(), 3000);
  });
};

window.submitFeedback = function (locationId, type) {
  db.collection("locations").doc(locationId).collection("feedback").add({
    type,
    submittedAt: new Date()
  }).then(() => {
    alert(type === "like" ? "Thanks for confirming!" : "Flag received. We'll review it.");
  });
};
