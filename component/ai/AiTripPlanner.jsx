"use client";
import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

// Main App component
export default function AiTripPlanner() {
  // State variables for user inputs
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [interests, setInterests] = useState([]); // Changed to array for multi-select
  const [budget, setBudget] = useState("");
  const [tripPlan, setTripPlan] = useState(null); // Changed to null/object for structured data
  const [loading, setLoading] = useState(false); // For AI generation
  const [error, setError] = useState(""); // General error messages
  const [saveLoading, setSaveLoading] = useState(false); // For save operation
  const [saveError, setSaveError] = useState(""); // Save specific error messages
  const [savedPlans, setSavedPlans] = useState([]); // Array to store fetched plans
  const [showSavedPlansModal, setShowSavedPlansModal] = useState(false); // Controls modal visibility
  const [activeDayTab, setActiveDayTab] = useState(0); // For controlling active day tab

  // Firebase related states
  const [db, setDb] = useState(null); // Firestore database instance
  const [auth, setAuth] = useState(null); // Firebase Auth instance
  const [userId, setUserId] = useState(null); // Current authenticated user's ID
  const [isAuthReady, setIsAuthReady] = useState(false); // Flag to ensure Firebase auth is initialized

  // Ref for the Bootstrap modal instance
  const savedPlansModalRef = useRef(null);
  const modalInstanceRef = useRef(null); // Stores the Bootstrap Modal instance

  // Predefined interests for the dropdown
  const predefinedInterests = [
    "Adventure",
    "Art & Culture",
    "Beaches",
    "City Exploration",
    "Cruises",
    "Family Fun",
    "Food & Drink",
    "History",
    "Hiking",
    "Nature",
    "Nightlife",
    "Relaxation",
    "Shopping",
    "Skiing",
    "Wildlife",
  ];

  // Initialize Firebase and handle authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Retrieve global variables provided by the Canvas environment (or default for local)
        const appId =
          typeof __app_id !== "undefined" ? __app_id : "default-app-id";
        let firebaseConfig =
          typeof __firebase_config !== "undefined"
            ? JSON.parse(__firebase_config)
            : {};

        // ===> CRITICAL: This is where you replace placeholder Firebase config <===
        // If environment config is not provided or is empty, use the hardcoded one.
        if (
          Object.keys(firebaseConfig).length === 0 ||
          !firebaseConfig.projectId ||
          firebaseConfig.projectId === "aitripplanner-16df8"
        ) {
          console.warn(
            "Firebase config not provided by environment. Using hardcoded config. Ensure this matches your Firebase project and Anonymous Authentication is enabled."
          );
          firebaseConfig = {
            apiKey: "AIzaSyAANxbXFnS38-zTIBWDAtnWpBMJGcmMOMc",
            authDomain: "aitripplanner-16df8.firebaseapp.com",
            projectId: "aitripplanner-16df8",
            storageBucket: "aitripplanner-16df8.firebasestorage.app",
            messagingSenderId: "559849914673",
            appId: "1:559849914673:web:fe515b6ad9e4a28177b010",
          };
        }

        const initialAuthToken =
          typeof __initial_auth_token !== "undefined"
            ? __initial_auth_token
            : null;

        // Initialize Firebase app, Firestore, and Auth
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Attempt to sign in: custom token (Canvas) or anonymously (local/default)
        if (initialAuthToken) {
          await signInWithCustomToken(firebaseAuth, initialAuthToken);
        } else {
          await signInAnonymously(firebaseAuth);
        }

        // Listen for auth state changes to get the user ID
        onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
            console.log("Firebase User ID:", user.uid);
          } else {
            // Fallback for unauthenticated users (e.g., if anonymous sign-in fails)
            setUserId(crypto.randomUUID());
            console.log("Signed in anonymously or no user.");
          }
          setIsAuthReady(true); // Mark authentication as ready
        });
      } catch (err) {
        console.error("Failed to initialize Firebase:", err);
        if (err.code === "auth/configuration-not-found") {
          setError(
            `Firebase Authentication Error: ${err.message}. Please ensure 'Anonymous' sign-in provider is ENABLED in your Firebase project's Authentication settings.`
          );
        } else {
          setError(
            `Failed to initialize the application: ${err.message}. Please ensure Firebase is correctly configured.`
          );
        }
      }
    };

    initializeFirebase();
  }, []); // Empty dependency array means this runs only once on component mount

  // Effect to fetch saved plans when auth is ready and userId is available
  useEffect(() => {
    if (
      db &&
      userId &&
      isAuthReady &&
      !error.includes("Firebase not configured")
    ) {
      // Only fetch if Firebase is configured
      const appId =
        typeof __app_id !== "undefined" ? __app_id : "default-app-id";
      const userPlansCollectionRef = collection(
        db,
        `artifacts/${appId}/users/${userId}/tripPlans`
      );
      // Order by createdAt to show most recent first
      const q = query(userPlansCollectionRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const plans = snapshot.docs
            .map((doc) => ({
              id: doc.id, // Document ID from Firestore
              ...doc.data(), // All other fields from the document
            }))
            .sort(
              (a, b) =>
                (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
            ); // Sort by creation time (newest first)
          setSavedPlans(plans); // Update state with fetched plans
        },
        (err) => {
          console.error("Error fetching saved plans:", err);
          setError(
            "Failed to load saved plans. Check Firebase configuration and permissions."
          );
        }
      );

      // Cleanup function: unsubscribe from real-time updates when the component unmounts
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady, error]); // Dependencies: re-run if any of these change

  // Initialize Bootstrap Modal
  useEffect(() => {
    // Check if Bootstrap JS is loaded and the modal DOM element exists
    if (
      typeof window !== "undefined" &&
      window.bootstrap &&
      savedPlansModalRef.current
    ) {
      modalInstanceRef.current = new window.bootstrap.Modal(
        savedPlansModalRef.current
      );

      // Add event listeners to sync React state with Bootstrap modal's visibility
      savedPlansModalRef.current.addEventListener("show.bs.modal", () =>
        setShowSavedPlansModal(true)
      );
      savedPlansModalRef.current.addEventListener("hidden.bs.modal", () =>
        setShowSavedPlansModal(false)
      );
    }
  }, []);

  // Control Bootstrap modal visibility
  useEffect(() => {
    if (modalInstanceRef.current) {
      if (showSavedPlansModal) {
        modalInstanceRef.current.show();
      } else {
        modalInstanceRef.current.hide();
      }
    }
  }, [showSavedPlansModal]);

  // Function to call the Gemini API for trip planning
  const generateTripPlan = async () => {
    setLoading(true);
    setError("");
    setTripPlan(null); // Reset trip plan to null
    setActiveDayTab(0); // Reset active day tab

    // Construct a detailed prompt for the AI model based on user inputs
    // Requesting JSON output with a specific schema
    const prompt = `
      Create a detailed trip plan for the following criteria:
      Destination: ${destination}
      Start Date: ${startDate}
      End Date: ${endDate}
      Interests: ${interests.join(", ")}
      Budget: ${budget}

      Provide the itinerary as a JSON array. Each element in the array should represent a day.
      Each day object should have:
      - "day": (number) The day number (e.g., 1, 2)
      - "date": (string) The date for the day (e.g., "YYYY-MM-DD")
      - "activities": (array of objects) An array of activities for that day.
        Each activity object should have:
        - "time": (string) Suggested time slot (e.g., "9:00 AM - 11:00 AM")
        - "name": (string) Name of the activity/place (e.g., "Louvre Museum")
        - "description": (string) A brief description of the activity.
        - "estimatedCost": (string) Estimated cost (e.g., "$50 per person", "Free")
        - "location": (string) A general location or landmark for Google Maps search.

      Example JSON structure:
      [
        {
          "day": 1,
          "date": "2025-07-15",
          "activities": [
            {
              "time": "9:00 AM - 12:00 PM",
              "name": "Eiffel Tower",
              "description": "Visit the iconic Eiffel Tower and enjoy panoramic views of Paris.",
              "estimatedCost": "€25",
              "location": "Eiffel Tower, Paris"
            },
            {
              "time": "1:00 PM - 3:00 PM",
              "name": "Louvre Museum",
              "description": "Explore one of the world's largest art museums, home to the Mona Lisa.",
              "estimatedCost": "€22",
              "location": "Louvre Museum, Paris"
            }
          ]
        }
      ]
      Generate the full plan based on the provided criteria.
    `;

    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json", // Request JSON response
          responseSchema: {
            // Define the expected JSON schema
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                day: { type: "NUMBER" },
                date: { type: "STRING" },
                activities: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      time: { type: "STRING" },
                      name: { type: "STRING" },
                      description: { type: "STRING" },
                      estimatedCost: { type: "STRING" },
                      location: { type: "STRING" },
                    },
                    required: ["time", "name", "description"], // Minimal required fields
                  },
                },
              },
              required: ["day", "date", "activities"], // Minimal required fields
            },
          },
        },
      };

      // Call the Gemini API
      const apiKey = "AIzaSyBpk5a2frtCFQVtma20s1DO3z6S9CGVIE0"; // Your Gemini API Key
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API error: ${response.status} ${response.statusText} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const jsonText = result.candidates[0].content.parts[0].text;
        try {
          const parsedPlan = JSON.parse(jsonText);
          if (Array.isArray(parsedPlan) && parsedPlan.length > 0) {
            setTripPlan(parsedPlan);
            setActiveDayTab(0); // Set first day as active
          } else {
            setError("AI generated an invalid or empty trip plan structure.");
          }
        } catch (parseError) {
          console.error("Error parsing AI response:", parseError);
          setError(
            "Failed to parse AI response. Please try again or refine your request."
          );
        }
      } else {
        setError("Could not generate trip plan. No content returned from AI.");
      }
    } catch (err) {
      console.error("Error generating trip plan:", err);
      setError(`Failed to generate trip plan: ${err.message}`);
    } finally {
      setLoading(false); // End loading state
    }
  };

  // Function to save the current trip plan to Firestore
  const saveTripPlan = async () => {
    if (
      !db ||
      !userId ||
      !tripPlan ||
      error.includes("Firebase not configured")
    ) {
      setSaveError(
        "Cannot save: Firebase not initialized, user not logged in, or no plan generated. Ensure Firebase config is correct."
      );
      return;
    }

    setSaveLoading(true);
    setSaveError("");

    try {
      const appId =
        typeof __app_id !== "undefined" ? __app_id : "default-app-id";
      // Use a combination of destination and timestamp for a more descriptive ID
      const docId = `${destination
        .replace(/\s+/g, "_")
        .toLowerCase()}_${Date.now()}`;
      const planRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/tripPlans`,
        docId
      );

      await setDoc(planRef, {
        destination,
        startDate,
        endDate,
        interests, // interests is stored as an array
        budget,
        planContent: JSON.stringify(tripPlan), // Store structured plan as string
        createdAt: serverTimestamp(), // Use Firestore's server timestamp for consistent ordering
      });
      console.log("Trip plan saved successfully!");
    } catch (err) {
      console.error("Error saving trip plan:", err);
      setSaveError(
        `Failed to save trip plan: ${err.message}. Check Firebase configuration and security rules.`
      );
    } finally {
      setSaveLoading(false); // End saving loading state
    }
  };

  // Function to load a saved plan back into the form and display area
  const loadSavedPlan = (plan) => {
    setDestination(plan.destination);
    setStartDate(plan.startDate);
    setEndDate(plan.endDate);
    setInterests(plan.interests || []); // Ensure interests is an array when loading
    setBudget(plan.budget);
    try {
      setTripPlan(JSON.parse(plan.planContent)); // Parse structured plan from string
      setActiveDayTab(0); // Set first day as active
    } catch (e) {
      console.error("Error parsing saved plan content:", e);
      setError("Failed to load saved plan content due to parsing error.");
      setTripPlan(null); // Clear plan if parsing fails
    }
    setShowSavedPlansModal(false); // Hide saved plans modal after loading
  };

  // Function to reset all form fields
  const resetForm = () => {
    setDestination("");
    setStartDate("");
    setEndDate("");
    setInterests([]); // Reset interests to an empty array
    setBudget("");
    setTripPlan(null); // Reset trip plan to null
    setLoading(false);
    setError("");
    setSaveLoading(false);
    setSaveError("");
    setActiveDayTab(0);
  };

  const currentDayPlan = tripPlan ? tripPlan[activeDayTab] : null;

  return (
    <>
      {/* Bootstrap CSS CDN */}
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
        xintegrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
        crossOrigin="anonymous"
      />
      {/* Google Fonts - Inter */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      {/* Font Awesome for Icons */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
        xintegrity="sha512-Fo3rlrZj/k7ujTnHg4CGR2D7kSs0V4LLanw2qksYuRlEzO+tcaEPQogQ0KaoGN26/zrn20ImR1DfuLWnOo7aBA=="
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />

      {/* Custom CSS for gradient background and font */}
      <style>
        {`
        body {
          font-family: 'Inter', sans-serif;
        }
        .gradient-bg {
          background: linear-gradient(to bottom right, #e0f7fa, #e8eaf6); /* Light blue to light purple */
        }
        .text-gradient {
          background: linear-gradient(to right, #0d6efd, #6f42c1); /* Bootstrap primary to purple */
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .btn-gradient-primary {
          background: linear-gradient(to right, #0d6efd, #6f42c1);
          border: none;
          transition: all 0.3s ease;
        }
        .btn-gradient-primary:hover {
          background: linear-gradient(to right, #0b5ed7, #5c37a7);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .btn-gradient-success {
          background: linear-gradient(to right, #198754, #20c997);
          border: none;
          transition: all 0.3s ease;
        }
        .btn-gradient-success:hover {
          background: linear-gradient(to right, #157347, #17a2b8);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .btn-gradient-secondary {
          background: linear-gradient(to right, #6c757d, #adb5bd);
          border: none;
          transition: all 0.3s ease;
        }
        .btn-gradient-secondary:hover {
          background: linear-gradient(to right, #5a6268, #9ea7ae);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .btn-gradient-danger {
          background: linear-gradient(to right, #dc3545, #fd7e14);
          border: none;
          transition: all 0.3s ease;
        }
        .btn-gradient-danger:hover {
          background: linear-gradient(to right, #c82333, #e06200);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .card {
          border-radius: 1rem;
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
        }
        .form-control, .form-select {
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
        }
        .form-control:focus, .form-select:focus {
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
          border-color: #0d6efd;
        }
        .nav-pills .nav-link {
            border-radius: 1.5rem;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            color: #6c757d;
            transition: all 0.3s ease;
        }
        .nav-pills .nav-link.active, .nav-pills .nav-link:hover {
            background: linear-gradient(to right, #0d6efd, #6f42c1);
            color: white;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .activity-card {
            border-radius: 1rem;
            overflow: hidden;
            box-shadow: 0 0.25rem 0.5rem rgba(0,0,0,0.1);
            transition: transform 0.2s ease-in-out;
        }
        .activity-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15);
        }
        .activity-card img {
            height: 180px;
            object-fit: cover;
        }
        .timeline-item {
            position: relative;
            padding-left: 2rem;
            margin-bottom: 2rem;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0.5rem;
            width: 2px;
            height: 100%;
            background-color: #dee2e6;
        }
        .timeline-item:last-child::before {
            height: calc(100% - 1.5rem); /* Adjust to stop before the end of the last item */
        }
        .timeline-item .timeline-marker {
            position: absolute;
            top: 0;
            left: 0;
            width: 1.5rem;
            height: 1.5rem;
            background-color: #0d6efd;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 1;
            box-shadow: 0 0 0 4px #e0f7fa;
        }
        .rating .fa-star {
            color: #ffc107; /* Bootstrap yellow */
        }
        `}
      </style>

      <div className="min-vh-100 d-flex align-items-center justify-content-center py-4 gradient-bg">
        <div className="card p-4 p-md-5 w-100" style={{ maxWidth: "800px" }}>
          <h1 className="text-center mb-4">
            <span className="text-gradient fw-bold">AI Trip Planner</span>
          </h1>

          {/* User ID display for collaborative context (if applicable) */}
          {/* {userId && (
            <div className="text-muted text-center mb-4 small">
              Your User ID:{" "}
              <span className="fw-semibold text-dark text-break">{userId}</span>
            </div>
          )} */}

          <div className="row g-3 mb-4">
            {/* Destination Input */}
            <div className="col-12 col-md-6">
              <label htmlFor="destination" className="form-label fw-semibold">
                Destination
              </label>
              <input
                type="text"
                id="destination"
                className="form-control"
                placeholder="e.g., Paris, Japan, Grand Canyon"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>

            {/* Start Date Input */}
            <div className="col-12 col-md-6">
              <label htmlFor="startDate" className="form-label fw-semibold">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                className="form-control"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // If endDate is before new startDate, reset endDate
                  if (endDate && new Date(endDate) < new Date(e.target.value)) {
                    setEndDate("");
                  }
                }}
              />
            </div>

            {/* End Date Input */}
            <div className="col-12 col-md-6">
              <label htmlFor="endDate" className="form-label fw-semibold">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate} // Set minimum date based on startDate
                disabled={!startDate} // Disable if startDate is not set
              />
            </div>

            {/* Interests Dropdown (Multi-select) */}
            <div className="col-12 col-md-6">
              <label htmlFor="interests" className="form-label fw-semibold">
                Interests (Select multiple)
              </label>
              <select
                id="interests"
                className="form-select"
                multiple // Enable multi-select
                value={interests}
                onChange={(e) => {
                  const selectedOptions = Array.from(
                    e.target.selectedOptions
                  ).map((option) => option.value);
                  setInterests(selectedOptions);
                }}
              >
                {predefinedInterests.map((interest, index) => (
                  <option key={index} value={interest}>
                    {interest}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget Input */}
            <div className="col-12">
              <label htmlFor="budget" className="form-label fw-semibold">
                Budget (e.g., low, medium, high, $1000)
              </label>
              <input
                type="text"
                id="budget"
                className="form-control"
                placeholder="e.g., medium, $2000 for the whole trip"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>

          <div className="d-grid gap-3">
            {/* Generate Plan Button */}
            <button
              onClick={generateTripPlan}
              disabled={loading || !destination || !startDate || !endDate}
              className="btn btn-lg btn-gradient-primary fw-bold"
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Generating...
                </>
              ) : (
                "Generate Trip Plan"
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={resetForm}
              className="btn btn-lg btn-gradient-danger fw-bold"
            >
              Reset Form
            </button>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="alert alert-danger mt-4" role="alert">
              <h5 className="alert-heading">Error:</h5>
              <p className="mb-0">{error}</p>
            </div>
          )}

          {/* Trip Plan Display */}
          {tripPlan && Array.isArray(tripPlan) && tripPlan.length > 0 && (
            <div className="mt-5 pt-4 border-top border-2 border-light">
              <h2 className="text-center mb-4 text-gradient fw-bold">
                Your AI-Generated Trip Plan
              </h2>

              {/* Day Tabs */}
              <ul className="nav nav-pills nav-fill mb-4">
                {tripPlan.map((dayData, index) => (
                  <li className="nav-item" key={dayData.day}>
                    <button
                      className={`nav-link ${
                        activeDayTab === index ? "active" : ""
                      }`}
                      onClick={() => setActiveDayTab(index)}
                    >
                      Day {dayData.day}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Current Day Itinerary */}
              {currentDayPlan && (
                <div className="tab-content">
                  <div className="tab-pane fade show active">
                    <h4 className="text-center mb-4 text-secondary">
                      {currentDayPlan.date
                        ? new Date(currentDayPlan.date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )
                        : `Day ${currentDayPlan.day}`}
                    </h4>
                    <div className="itinerary-timeline">
                      {currentDayPlan.activities &&
                        currentDayPlan.activities.map(
                          (activity, activityIndex) => (
                            <div className="timeline-item" key={activityIndex}>
                              <div className="timeline-marker">
                                {activityIndex + 1}
                              </div>
                              <div className="card activity-card mb-3">
                                {/* Placeholder Image */}
                                <img
                                  src={`https://placehold.co/600x180/${Math.floor(
                                    Math.random() * 16777215
                                  ).toString(16)}/${Math.floor(
                                    Math.random() * 16777215
                                  ).toString(16)}?text=${activity.name.replace(
                                    /\s/g,
                                    "+"
                                  )}`}
                                  className="card-img-top"
                                  alt={activity.name}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      "https://placehold.co/600x180/cccccc/000000?text=Image+Not+Found";
                                  }}
                                />
                                <div className="card-img-overlay d-flex justify-content-end align-items-start p-2">
                                  <i className="fas fa-pencil-alt text-white bg-dark bg-opacity-50 rounded-circle p-2 cursor-pointer"></i>
                                </div>
                                <div className="card-body">
                                  <h5 className="card-title text-primary fw-bold">
                                    {activity.name}
                                  </h5>
                                  <p className="card-text text-muted small mb-2">
                                    <i className="far fa-clock me-1"></i>{" "}
                                    {activity.time || "Time not specified"}
                                  </p>
                                  <p className="card-text">
                                    {activity.description}
                                  </p>
                                  <ul className="list-unstyled small text-muted mt-3">
                                    <li className="mb-1">
                                      <span className="rating">
                                        {[
                                          ...Array(
                                            Math.floor(Math.random() * 3) + 3
                                          ),
                                        ].map((_, i) => (
                                          <i
                                            key={i}
                                            className="fas fa-star"
                                          ></i>
                                        ))}
                                        {[
                                          ...Array(
                                            5 -
                                              (Math.floor(Math.random() * 3) +
                                                3)
                                          ),
                                        ].map((_, i) => (
                                          <i
                                            key={i}
                                            className="far fa-star"
                                          ></i>
                                        ))}
                                      </span>{" "}
                                      {Math.floor(Math.random() * 100000) +
                                        1000}{" "}
                                      reviews
                                    </li>
                                    <li className="mb-1">
                                      <i className="fas fa-info-circle me-1"></i>{" "}
                                      {Math.floor(Math.random() * 20) + 80}%
                                      matched
                                    </li>
                                    <li className="mb-1">
                                      <i className="fas fa-hourglass-half me-1"></i>{" "}
                                      People typically spend{" "}
                                      {Math.floor(Math.random() * 120) + 30}m
                                      here
                                    </li>
                                    {activity.estimatedCost && (
                                      <li className="mb-1">
                                        <i className="fas fa-money-bill-wave me-1"></i>{" "}
                                        Cost: {activity.estimatedCost}
                                      </li>
                                    )}
                                    {activity.location && (
                                      <li>
                                        <a
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            activity.location
                                          )}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-decoration-none"
                                        >
                                          <i className="fas fa-map-marker-alt me-1"></i>{" "}
                                          View on Google Map
                                        </a>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Trip Plan Button */}
              <button
                onClick={saveTripPlan}
                disabled={
                  saveLoading ||
                  !tripPlan ||
                  !db ||
                  !userId ||
                  error.includes("Firebase not configured")
                }
                className="btn btn-lg btn-gradient-success w-100 mt-4 fw-bold"
              >
                {saveLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : (
                  "Save Trip Plan"
                )}
              </button>

              {saveError && (
                <div className="alert alert-danger mt-2 small" role="alert">
                  <p className="mb-0 fw-semibold">Save Error:</p>
                  <p className="mb-0">{saveError}</p>
                </div>
              )}
            </div>
          )}

          {/* Toggle Saved Plans Button */}
          <button
            onClick={() => setShowSavedPlansModal(true)}
            className="btn btn-lg btn-gradient-secondary w-100 mt-5 fw-bold"
          >
            Show Saved Plans ({savedPlans.length})
          </button>
        </div>
      </div>

      {/* Saved Plans Modal */}
      <div
        className="modal fade"
        id="savedPlansModal"
        tabIndex="-1"
        aria-labelledby="savedPlansModalLabel"
        aria-hidden="true"
        ref={savedPlansModalRef}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          {" "}
          {/* Increased modal size */}
          <div className="modal-content">
            <div className="modal-header">
              <h5
                className="modal-title text-gradient fw-bold"
                id="savedPlansModalLabel"
              >
                Your Saved Trip Plans
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {savedPlans.length > 0 ? (
                savedPlans.map((plan) => (
                  <div key={plan.id} className="card mb-3 shadow-sm">
                    <div className="card-body">
                      <h6 className="card-title text-primary fw-semibold">
                        {plan.destination} (
                        {new Date(plan.startDate).toLocaleDateString()} -{" "}
                        {new Date(plan.endDate).toLocaleDateString()})
                      </h6>
                      <p className="card-text small text-muted mb-1">
                        Interests:{" "}
                        {Array.isArray(plan.interests)
                          ? plan.interests.join(", ")
                          : plan.interests || "N/A"}
                      </p>
                      <p className="card-text small text-muted mb-2">
                        Budget: {plan.budget || "N/A"}
                      </p>
                      <button
                        onClick={() => loadSavedPlan(plan)}
                        className="btn btn-sm btn-outline-primary"
                      >
                        Load Plan
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert alert-info text-center" role="alert">
                  No saved plans yet. Generate and save one!
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bootstrap JS (must be at the end of the body for proper functioning) */}
      <script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
        xintegrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
        crossOrigin="anonymous"
      ></script>
    </>
  );
}
