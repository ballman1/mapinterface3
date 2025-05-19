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

// Sign in anonymously
auth.signInAnonymously().catch(console.error);

// Initialize the map
window.initMap = async function () {
  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 39.8283, lng: -98.5795 }, // Center of US
    zoom: 5
  });

  // Load existing locations from Firestore
  db.collection("locations").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const marker = new google.maps.Marker({
        position: { lat: data.lat, lng: data.lng },
        map,
        title: data.name
      });

      const info = new google.maps.InfoWindow({
        content: `<strong>${data.name}</strong><br>${data.address}<br>Type: ${data.type}`
      });

      marker.addListener("click", () => {
        info.open(map, marker);
      });
    });
  });
};

// Wait for the page to load, then bind the form
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("location-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("location-name").value;
    const type = document.getElementById("location-type").value;
    const address = document.getElementById("location-address").value;

    // Use Geocoding API to get coordinates
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyASHf6jmZTRP_zxWdSbaI205EMmlg-Q0Qc&callback=initMap">`
    );
    const data = await response.json();

    if (!data.results.length) {
      alert("Address not found. Please try a more specific location.");
      return;
    }

    const location = data.results[0].geometry.location;

    // Add to Firestore
    await db.collection("locations").add({
      name,
      type,
      address,
      lat: location.lat,
      lng: location.lng,
      submittedAt: new Date()
    });

    alert("Location added!");
    window.location.reload();
  });
});