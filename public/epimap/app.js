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
  // Default center (center of US)
  let mapCenter = { lat: 39.8283, lng: -98.5795 };
  let zoomLevel = 5;

  // Try to use browser geolocation
  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      mapCenter = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      zoomLevel = 13;
    } catch (e) {
      // If user denies or error, fallback to default center
    }
  }

  const map = new google.maps.Map(document.getElementById("map"), {
    center: mapCenter,
    zoom: zoomLevel
  });

  const iconDefault = "images/epipen_icon_transparent_32x32.png";
  const iconVerified = "images/epipen_icon_transparent_32x32.png";

  // Load existing locations
  const snapshot = await db.collection("locations").get();
  for (const doc of snapshot.docs) {
    const data = doc.data();

    const feedbackSnap = await db.collection("locations").doc(doc.id).collection("feedback").get();
    let likes = 0, flags = 0;
    feedbackSnap.forEach(f => {
      if (f.data().type === "like") likes++;
      if (f.data().type === "flag") flags++;
    });

    // Use AdvancedMarkerElement if available, else fallback to Marker
    let marker;
    if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
      marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: data.lat, lng: data.lng },
        title: data.name,
        content: (() => {
          const img = document.createElement('img');
          img.src = data.verifiedByBusiness ? iconVerified : iconDefault;
          img.width = 32;
          img.height = 32;
          return img;
        })()
      });
    } else {
      marker = new google.maps.Marker({
        position: { lat: data.lat, lng: data.lng },
        map,
        title: data.name,
        icon: {
          url: data.verifiedByBusiness ? iconVerified : iconDefault,
          scaledSize: new google.maps.Size(32, 32)
        }
      });
    }

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <strong>${data.name}</strong><br>
        ${data.address}<br>
        Type: ${data.type}<br>
        ${data.verifiedByBusiness ? "<span style='color:green'>✅ Verified by the business</span><br>" : ""}
        <button onclick="submitFeedback('${doc.id}', 'like')">👍 Confirm</button>
        <button onclick="submitFeedback('${doc.id}', 'flag')">🚩 Flag</button><br>
        👍 ${likes} | 🚩 ${flags}<br><br>
        ${!data.verifiedByBusiness ? `<a href='mailto:verify@epipenmap.org?subject=Verify My EpiPen Location&body=Name: ${data.name}%0D%0AAddress: ${data.address}'>Request to Verify</a>` : ""}
      `
    });

    if (marker.addListener) {
      marker.addListener("click", () => infoWindow.open(map, marker));
    } else if (marker.element) {
      marker.element.addEventListener("click", () => infoWindow.open(map, marker));
    }
  }

  // Add new location on map click
  map.addListener("click", async function (event) {
    const clickedLatLng = event.latLng;
    const confirmTag = window.confirm(
      "You are about to tag this location as having an Epinephrine autoinjector (Epipen) on site.\n\nIf this is correct, please click Confirm."
    );
    if (!confirmTag) return;

    // Use the new Place API to find the most accurate place at the clicked location
    let placeName = "Community Location";
    let placeAddress = "";

    try {
      if (google.maps.places && google.maps.places.Place) {
        const { Place } = google.maps.places;
        const place = new Place({
          location: clickedLatLng,
          fields: ["displayName", "formattedAddress", "location"]
        });
        const result = await place.fetchFields();
        if (result.displayName) placeName = result.displayName;
        if (result.formattedAddress) placeAddress = result.formattedAddress;
      } else {
        throw new Error("Place API not available");
      }
    } catch (e) {
      // fallback to geocode address if Place API fails
      const geocode = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${clickedLatLng.lat()},${clickedLatLng.lng()}&key=AIzaSyASHf6jmZTRP_zxWdSbaI205EMmlg-Q0Qc`);
      const data = await geocode.json();
      placeAddress = data.results[0]?.formatted_address || "";
      placeName = placeAddress || "Community Location";
    }

    const locationData = {
      name: placeName,
      type: "community-tagged",
      address: placeAddress,
      lat: clickedLatLng.lat(),
      lng: clickedLatLng.lng(),
      submittedAt: new Date(),
      verifiedByBusiness: false
    };

    await db.collection("locations").add(locationData);

    // Add marker for new location (immediately, no reload)
    let marker;
    if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
      marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: clickedLatLng,
        title: locationData.name,
        content: (() => {
          const img = document.createElement('img');
          img.src = iconDefault;
          img.width = 32;
          img.height = 32;
          return img;
        })()
      });
    } else {
      marker = new google.maps.Marker({
        position: clickedLatLng,
        map,
        title: locationData.name,
        icon: {
          url: iconDefault,
          scaledSize: new google.maps.Size(32, 32)
        }
      });
    }

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <strong>${locationData.name}</strong><br>
        ${locationData.address}<br>
        Type: ${locationData.type}<br>
        <button onclick="submitFeedbackTemp()">👍 Confirm</button>
        <button onclick="submitFeedbackTemp()">🚩 Flag</button><br>
        <br>
      `
    });

    if (marker.addListener) {
      marker.addListener("click", () => infoWindow.open(map, marker));
    } else if (marker.element) {
      marker.element.addEventListener("click", () => infoWindow.open(map, marker));
    }

    // Show confirmation as before, but no reload
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

    window.submitFeedbackTemp = function () {
      alert("Feedback will be available after page reload.");
    };

  }); // closes map.addListener("click", ...)

}; // closes window.initMap

window.submitFeedback = function (locationId, type) {
  db.collection("locations").doc(locationId).collection("feedback").add({
    type,
    submittedAt: new Date()
  }).then(() => {
    alert(type === "like" ? "Thanks for confirming!" : "Flag received. We'll review it.");
  });
};