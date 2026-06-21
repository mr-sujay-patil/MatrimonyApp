import React, { useState, useEffect } from 'react';
import './App.css';

const AUTH_URL = 'http://localhost:3001';
const PROFILE_URL = 'http://localhost:3002';
const MEDIA_URL = 'http://localhost:3008';

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [authStep, setAuthStep] = useState<'request' | 'verify'>('request');
  const [authError, setAuthError] = useState('');

  // Profile Onboarding State
  const [profile, setProfile] = useState<any>(null);
  const [onboardStep, setOnboardStep] = useState<number>(1);
  const [profileForm, setProfileForm] = useState({
    first_name: 'Priya',
    last_name: 'Sharma',
    date_of_birth: '1996-04-12',
    gender: 'FEMALE',
    religion: 'Hindu',
    caste: 'Brahmin',
    mother_tongue: 'Hindi',
    marital_status: 'NEVER_MARRIED',
    height_cm: 163,
    body_type: 'Slim',
    diet: 'Veg',
    smoking: 'NO',
    drinking: 'NO',
    education: 'B.Tech',
    education_detail: 'Computer Science',
    occupation: 'Software Engineer',
    employer: 'Google',
    annual_income_inr: 1200000,
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    about_me: 'Nature lover, avid reader...',
  });

  // Family details onboarding
  const [familyForm, setFamilyForm] = useState({
    father_name: 'Rajesh Sharma',
    father_occupation: 'Doctor',
    mother_name: 'Sunita Sharma',
    mother_occupation: 'Teacher',
    siblings_count: 1,
    family_type: 'Nuclear',
    family_status: 'Upper Middle Class',
    family_values: 'Moderate',
    native_place: 'Jaipur',
  });

  // Partner Preferences State
  const [preferences, setPreferences] = useState({
    age_min: 24,
    age_max: 32,
    height_min_cm: 155,
    height_max_cm: 185,
    religions: ['Hindu'],
    locations: ['Bengaluru', 'Mumbai'],
  });

  // Photos State
  const [photos, setPhotos] = useState<any[]>([]);

  // Matches Search State
  const [matches, setMatches] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    age_min: 22,
    age_max: 35,
    city: '',
  });

  // Checklist State
  const [checklist, setChecklist] = useState<any>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'onboard' | 'preferences' | 'photos' | 'matches'>('onboard');

  // Trigger loading profile after login
  useEffect(() => {
    if (token) {
      loadOwnProfile();
    }
  }, [token]);

  const loadOwnProfile = async () => {
    try {
      const res = await fetch(`${PROFILE_URL}/api/v1/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 200) {
        const data = await res.json();
        setProfile(data);
        if (data.family) setFamilyForm(data.family);
        if (data.preferences) setPreferences(data.preferences);
        loadPhotos(data.profile_id);
        loadChecklist();
      } else {
        // Not found / Not created yet
        setProfile(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadChecklist = async () => {
    try {
      const res = await fetch(`${PROFILE_URL}/api/v1/profiles/me/completion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 200) {
        const data = await res.json();
        setChecklist(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadPhotos = async (profileId: string) => {
    try {
      const res = await fetch(`${MEDIA_URL}/api/v1/media/photos?profile_id=${profileId}`);
      if (res.status === 200) {
        const data = await res.json();
        setPhotos(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Auth Operations
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Auto register user if they do not exist (development convenience)
      await fetch(`${AUTH_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          email: `test_${phone.replace(/\D/g, '')}@example.com`,
          password: 'StrongPassword@123',
          role: 'SEEKER'
        })
      });

      // Request OTP
      const res = await fetch(`${AUTH_URL}/api/v1/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone })
      });

      const data = await res.json();
      if (res.status === 200) {
        setOtpToken(data.otp_token);
        setMaskedPhone(data.masked_phone);
        setAuthStep('verify');
      } else {
        setAuthError(data.error?.message || 'Failed to request OTP');
      }
    } catch (e: any) {
      setAuthError('Connection failed.');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${AUTH_URL}/api/v1/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          otp,
          otp_token: otpToken
        })
      });
      const data = await res.json();
      if (res.status === 200) {
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
      } else {
        setAuthError(data.error?.message || 'Invalid verification OTP');
      }
    } catch (e) {
      setAuthError('Verification request failed.');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
    setChecklist(null);
    localStorage.removeItem('token');
  };

  // Onboarding Submit
  const handleOnboardSubmit = async () => {
    try {
      const payload = {
        ...profileForm,
        family: familyForm,
        preferences: preferences,
      };

      const res = await fetch(`${PROFILE_URL}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 201) {
        loadOwnProfile();
        setActiveTab('matches');
      } else {
        const data = await res.json();
        alert(data.message || 'Onboarding registration failed.');
      }
    } catch (e) {
      alert('Onboarding failed due to network error.');
    }
  };

  // Update Preferences (STORY-011)
  const handleSavePreferences = async () => {
    try {
      const res = await fetch(`${PROFILE_URL}/api/v1/profiles/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      });
      if (res.status === 200) {
        alert('Partner preferences updated successfully.');
        loadOwnProfile();
      }
    } catch (e) {
      alert('Failed to update preferences.');
    }
  };

  // Photo uploads mock (STORY-014)
  const handleUploadPhoto = async () => {
    if (!profile) return;
    try {
      const payload = {
        profile_id: profile.profile_id || profile.id,
        size: 204800,
        mime: 'image/jpeg'
      };

      const res = await fetch(`${MEDIA_URL}/api/v1/media/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 201) {
        loadPhotos(profile.profile_id || profile.id);
        alert('Photo uploaded and processed successfully.');
        loadOwnProfile();
      }
    } catch (e) {
      alert('Photo upload failed.');
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      const res = await fetch(`${MEDIA_URL}/api/v1/media/photos/${photoId}/primary`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 200) {
        // Associate photo id with profile too
        await fetch(`${PROFILE_URL}/api/v1/profiles/me`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ avatar_photo_id: photoId })
        });
        loadPhotos(profile.profile_id || profile.id);
        loadOwnProfile();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleVisibility = async (photoId: string, visibility: string) => {
    try {
      await fetch(`${MEDIA_URL}/api/v1/media/photos/${photoId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ visibility })
      });
      loadPhotos(profile.profile_id || profile.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Load Matches (STORY-017)
  const handleSearchMatches = async () => {
    // In our simplified mock setup, we return a mock list of matches or fetch from recommendation index
    setMatches([
      { id: '1', first_name: 'Aishwarya', last_name: 'Rao', age: 26, city: 'Bengaluru', occupation: 'UX Designer', religion: 'Hindu', height_cm: 165 },
      { id: '2', first_name: 'Anjali', last_name: 'Mehta', age: 28, city: 'Mumbai', occupation: 'Data Scientist', religion: 'Hindu', height_cm: 162 },
      { id: '3', first_name: 'Kabir', last_name: 'Singh', age: 30, city: 'Delhi', occupation: 'Product Manager', religion: 'Sikh', height_cm: 180 },
    ]);
  };

  return (
    <div className="container">
      {/* Header */}
      <header style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Matrimony platform
        </h1>
        {token && (
          <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {/* LOGIN FLOW (STORY-001 / STORY-002) */}
      {!token ? (
        <div className="card">
          <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>Authenticating Access</h2>
          {authError && <div style={{ color: 'red', marginBottom: '16px', fontSize: '14px' }}>{authError}</div>}

          {authStep === 'request' ? (
            <form onSubmit={handleRequestOTP}>
              <label>Phone Number (E.164 format):</label>
              <input
                type="text"
                placeholder="e.g. +919876543210"
                className="input-well"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
              <button type="submit" className="btn">Request OTP</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                OTP Sent to {maskedPhone}. Use dummy code <strong>111111</strong> to verify.
              </div>
              <label>Enter 6-Digit OTP:</label>
              <input
                type="text"
                placeholder="111111"
                className="input-well"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
              />
              <button type="submit" className="btn">Verify & Proceed</button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={() => setAuthStep('request')}
              >
                Go Back
              </button>
            </form>
          )}
        </div>
      ) : (
        /* LOGGED IN USER AREA */
        <div style={{ width: '100%', maxWidth: '1000px' }}>
          {/* Completion Progress bar Checklist (STORY-009) */}
          {checklist && (
            <div className="card-inset" style={{ marginBottom: '30px' }}>
              <div className="checklist-progress">
                <div>
                  <h3 style={{ margin: 0 }}>Profile Strength Checklist</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Completed: {checklist.completed_sections.join(', ')}
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {checklist.completion_percentage}%
                </div>
              </div>
              <div className="progress-bar-well">
                <div className="progress-bar-fill" style={{ width: `${checklist.completion_percentage}%` }}></div>
              </div>
              {!checklist.is_publishable && (
                <div style={{ color: '#d97706', fontSize: '13px', marginTop: '10px', fontWeight: 500 }}>
                  ⚠️ Upload at least 1 photo and configure preferences to reach publishable strength!
                </div>
              )}
            </div>
          )}

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '24px' }}>
            <button
              className={`step-indicator ${activeTab === 'onboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('onboard')}
            >
              My Profile Info
            </button>
            {profile && (
              <>
                <button
                  className={`step-indicator ${activeTab === 'preferences' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preferences')}
                >
                  Partner Preferences
                </button>
                <button
                  className={`step-indicator ${activeTab === 'photos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('photos')}
                >
                  Manage Photos
                </button>
                <button
                  className={`step-indicator ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('matches');
                    handleSearchMatches();
                  }}
                >
                  Match Board Grid
                </button>
              </>
            )}
          </div>

          {/* ONBOARDING WIZARD / PROFILE FORM (STORY-006 / STORY-007 / STORY-008) */}
          {activeTab === 'onboard' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <div className="wizard-header">
                <h2>{profile ? 'Edit Profile Details' : 'Matrimonial Onboarding Wizard'}</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span className={`step-indicator ${onboardStep === 1 ? 'active' : ''}`}>1. Personal</span>
                  <span className={`step-indicator ${onboardStep === 2 ? 'active' : ''}`}>2. Family</span>
                  <span className={`step-indicator ${onboardStep === 3 ? 'active' : ''}`}>3. Professional</span>
                </div>
              </div>

              {onboardStep === 1 && (
                <div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>First Name:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.first_name}
                        onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Last Name:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.last_name}
                        onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Date of Birth:</label>
                      <input
                        type="date"
                        className="input-well"
                        value={profileForm.date_of_birth}
                        onChange={e => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Gender:</label>
                      <select
                        className="input-well"
                        value={profileForm.gender}
                        onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
                      >
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Religion:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.religion}
                        onChange={e => setProfileForm({ ...profileForm, religion: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Height (cm):</label>
                      <input
                        type="number"
                        className="input-well"
                        value={profileForm.height_cm}
                        onChange={e => setProfileForm({ ...profileForm, height_cm: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <button className="btn" onClick={() => setOnboardStep(2)}>Next: Family Background</button>
                </div>
              )}

              {onboardStep === 2 && (
                <div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Father's Name:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={familyForm.father_name}
                        onChange={e => setFamilyForm({ ...familyForm, father_name: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Father's Occupation:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={familyForm.father_occupation}
                        onChange={e => setFamilyForm({ ...familyForm, father_occupation: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Mother's Name:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={familyForm.mother_name}
                        onChange={e => setFamilyForm({ ...familyForm, mother_name: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Family Values:</label>
                      <select
                        className="input-well"
                        value={familyForm.family_values}
                        onChange={e => setFamilyForm({ ...familyForm, family_values: e.target.value })}
                      >
                        <option value="Traditional">Traditional</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Liberal">Liberal</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '16px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOnboardStep(1)}>Back</button>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setOnboardStep(3)}>Next: Career & Diet</button>
                  </div>
                </div>
              )}

              {onboardStep === 3 && (
                <div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Highest Education:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.education}
                        onChange={e => setProfileForm({ ...profileForm, education: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>Current Occupation:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.occupation}
                        onChange={e => setProfileForm({ ...profileForm, occupation: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label>Dietary Type:</label>
                      <select
                        className="input-well"
                        value={profileForm.diet}
                        onChange={e => setProfileForm({ ...profileForm, diet: e.target.value })}
                      >
                        <option value="Veg">Veg</option>
                        <option value="Non-Veg">Non-Veg</option>
                        <option value="Eggitarian">Eggitarian</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label>City location:</label>
                      <input
                        type="text"
                        className="input-well"
                        value={profileForm.city}
                        onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', marginTop: '16px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOnboardStep(2)}>Back</button>
                    <button className="btn" style={{ flex: 1 }} onClick={handleOnboardSubmit}>
                      {profile ? 'Save Profile' : 'Onboard Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARTNER PREFERENCES (STORY-011) */}
          {activeTab === 'preferences' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <h2>Partner Match Criteria</h2>
              <div className="slider-container">
                <div className="slider-values">
                  <span>Age boundaries:</span>
                  <span>{preferences.age_min} - {preferences.age_max} years</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={preferences.age_min}
                    onChange={e => setPreferences({ ...preferences, age_min: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="range"
                    min={18}
                    max={60}
                    value={preferences.age_max}
                    onChange={e => setPreferences({ ...preferences, age_max: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label>Religions allowed:</label>
                  <input
                    type="text"
                    className="input-well"
                    placeholder="e.g. Hindu, Sikh"
                    value={preferences.religions.join(', ')}
                    onChange={e => setPreferences({ ...preferences, religions: e.target.value.split(',').map(s => s.trim()) })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Preferred Locations:</label>
                  <input
                    type="text"
                    className="input-well"
                    placeholder="e.g. Mumbai, Pune"
                    value={preferences.locations.join(', ')}
                    onChange={e => setPreferences({ ...preferences, locations: e.target.value.split(',').map(s => s.trim()) })}
                  />
                </div>
              </div>

              <button className="btn" onClick={handleSavePreferences}>Save Preferences</button>
            </div>
          )}

          {/* PHOTO MANAGER (STORY-014 / STORY-016) */}
          {activeTab === 'photos' && (
            <div className="card" style={{ maxWidth: '100%' }}>
              <h2>My Matrimonial Album</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Add up to 5 photos. Set a primary profile photo (avatar) and modify matching visibility limits.
              </p>

              <button className="btn" style={{ marginBottom: '20px' }} onClick={handleUploadPhoto}>
                + Mock File Upload
              </button>

              <div className="photo-grid">
                {photos.map(p => (
                  <div
                    key={p.photo_id}
                    className="photo-card"
                    style={{
                      backgroundImage: `url(${p.cdn_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300'})`,
                    }}
                  >
                    {p.is_primary && <div className="profile-badge">Avatar</div>}
                    <div className="actions">
                      <button onClick={() => handleSetPrimary(p.photo_id)}>Avatar</button>
                      <button onClick={() => handleToggleVisibility(p.photo_id, p.visibility === 'PUBLIC' ? 'MATCHES_ONLY' : 'PUBLIC')}>
                        {p.visibility}
                      </button>
                    </div>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 5 - photos.length) }).map((_, i) => (
                  <div key={i} className="photo-card empty" onClick={handleUploadPhoto}>
                    <span style={{ fontSize: '24px', color: 'var(--text-secondary)' }}>+</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MATCH BOARD (STORY-017) */}
          {activeTab === 'matches' && (
            <div className="matches-layout">
              {/* Sidebar filter */}
              <div className="card sidebar">
                <h3>Discovery Filters</h3>
                <label>Age Range Max:</label>
                <input
                  type="range"
                  min={18}
                  max={60}
                  value={searchFilters.age_max}
                  onChange={e => setSearchFilters({ ...searchFilters, age_max: parseInt(e.target.value) })}
                  style={{ width: '100%', marginBottom: '15px' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Max Age: {searchFilters.age_max} years
                </span>

                <div style={{ marginTop: '20px' }}>
                  <label>City Filter:</label>
                  <input
                    type="text"
                    className="input-well"
                    placeholder="Search by city"
                    value={searchFilters.city}
                    onChange={e => setSearchFilters({ ...searchFilters, city: e.target.value })}
                  />
                </div>
              </div>

              {/* Grid cards */}
              <div className="grid">
                {matches
                  .filter(m => m.age <= searchFilters.age_max)
                  .filter(m => !searchFilters.city || m.city.toLowerCase().includes(searchFilters.city.toLowerCase()))
                  .map(m => (
                    <div key={m.id} className="profile-card">
                      <div
                        className="profile-img-header"
                        style={{
                          backgroundImage: 'url(https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500)',
                        }}
                      >
                        <div className="profile-badge">92% Match</div>
                      </div>
                      <div className="profile-info">
                        <h4 style={{ margin: '0 0 8px', fontSize: '18px' }}>
                          {m.first_name} {m.last_name}, {m.age}
                        </h4>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {m.occupation} • {m.city}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {m.height_cm} cm • {m.religion}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
