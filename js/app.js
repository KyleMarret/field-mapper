// ========================================
// KAS FIELD SAMPLER - CLEAN BUILD
// Core mapping functionality without database complexity
// ========================================

// ========================================
// SOIL DATA LOOKUP
// ========================================

const SOIL_DATABASE = {
    '79B': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '0-2% slopes', ph: '5.5-7.3', cropNotes: 'Excellent crop performance. Level fields, minimal erosion risk.' },
    '79C2': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '2-5% slopes, eroded', ph: '5.5-7.3', cropNotes: 'Good crop performance. Moderate slope, watch for erosion on bare soil.' },
    '79D2': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '5-10% slopes, eroded', ph: '5.5-7.3', cropNotes: 'Fair to good. Steeper slope requires erosion management. Consider terracing.' },
    '79D3': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '5-10% slopes, severely eroded', ph: '5.5-7.3', cropNotes: 'Limited by severe erosion. May need soil amendments. Consider permanent cover.' },
    '79E2': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '10-15% slopes, eroded', ph: '5.5-7.3', cropNotes: 'Severe limitations. Best suited for hay or pasture. High erosion risk.' },
    '60001': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: 'Nearly level', ph: '5.5-7.3', cropNotes: 'Prime farmland. Excellent crop yields expected.' },
    '60165': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: 'Gently sloping', ph: '5.5-7.3', cropNotes: 'Very good productivity. Minor erosion concerns.' },
    '60180': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: 'Nearly level', ph: '5.5-7.3', cropNotes: 'High productivity potential. Good water holding capacity.' },
    '60182': { series: 'Menfro silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: 'Nearly level', ph: '5.5-7.3', cropNotes: 'Excellent for row crops. Deep topsoil.' },
    '90017': { series: 'Memphis silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '0-2% slopes, occasionally flooded', ph: '5.1-6.5', cropNotes: 'Good yields when not flooded. Monitor drainage after heavy rain.' },
    '90021': { series: 'Memphis silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '2-5% slopes', ph: '5.1-6.5', cropNotes: 'Very good for crops. Slightly lower pH than Menfro, may need lime.' },
    '90601': { series: 'Memphis silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '0-2% slopes', ph: '5.1-6.5', cropNotes: 'Excellent productivity. Deep silt loam, responds well to management.' },
    '73098': { series: 'Plato silt loam', texture: 'Silt loam', drainage: 'Moderately well drained', slope: '1-3% slopes', ph: '5.1-6.5', cropNotes: 'Good crop potential. Fragipan limits rooting depth. May have seasonal wetness.' },
    '73168': { series: 'Swiss gravelly silt loam', texture: 'Gravelly silt loam', drainage: 'Well drained', slope: '3-15% slopes, stony', ph: '5.6-6.5', cropNotes: 'Moderate productivity. Stones and slope limit use. Better suited for pasture or hay.' },
    '73172': { series: 'Rosati silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '1-5% slopes', ph: '5.6-7.3', cropNotes: 'Very good crop production. Fertile soil with good moisture retention.' },
    '73135': { series: 'Union silt loam', texture: 'Silt loam', drainage: 'Well drained', slope: '3-8% slopes', ph: '5.1-6.0', cropNotes: 'Good productivity. Naturally acidic, responds well to lime. Watch erosion on slopes.' },
    '76008': { series: 'Cedargap gravelly silt loam', texture: 'Gravelly silt loam', drainage: 'Well drained', slope: '1-3% slopes, frequently flooded', ph: '6.1-7.3', cropNotes: 'Limited by flooding. Best for pasture or hay. Avoid row crops near streams.' },
    '73039': { series: 'Glensted silt loam', texture: 'Silt loam', drainage: 'Moderately well drained', slope: '1-3% slopes', ph: '5.1-6.5', cropNotes: 'Good for crops. Fragipan present but deeper than Plato. May need drainage.' },
    '74634': { series: 'Hartville silt loam', texture: 'Silt loam', drainage: 'Somewhat poorly drained', slope: '3-8% slopes', ph: '5.1-6.5', cropNotes: 'Moderate productivity. Wetness limits spring fieldwork. Consider tile drainage.' },
    '73170': { series: 'Plato silt loam', texture: 'Silt loam', drainage: 'Moderately well drained', slope: '0-2% slopes', ph: '5.1-6.5', cropNotes: 'Similar to 73098. Fragipan restricts rooting. Good for soybeans if managed properly.' },
    '73179': { series: 'Viraton silt loam', texture: 'Silt loam', drainage: 'Moderately well drained', slope: '1-5% slopes', ph: '5.1-6.5', cropNotes: 'Fair to good. Fragipan present. Moderate natural fertility.' },
    '73169': { series: 'Plato-Viraton complex', texture: 'Silt loam', drainage: 'Moderately well drained', slope: '1-5% slopes', ph: '5.1-6.5', cropNotes: 'Variable productivity. Both soils have fragipan. Manage wet areas carefully.' }
};

function getSoilInfo(musym) {
    if (SOIL_DATABASE[musym]) {
        return SOIL_DATABASE[musym];
    }
    return {
        series: `Map Unit ${musym}`,
        texture: 'See Web Soil Survey',
        drainage: 'See Web Soil Survey',
        slope: 'Varies',
        ph: 'Unknown',
        cropNotes: 'Contact your local NRCS office for detailed information.'
    };
}

// ========================================
// GLOBAL STATE
// ========================================

let map;
let currentLocation = null;
let locationMarker = null;
let dataLayer = null;
let loadedData = null;
let isSatelliteView = true;

// Map tile layers
let satelliteTiles;
let labelsLayer;
let streetTiles;

// ========================================
// MAP INITIALIZATION
// ========================================

function initMap() {
    // Initialize map centered on Missouri
    map = L.map('map', {
        zoomControl: false
    }).setView([38.5, -92.5], 8);
    
    // Satellite tiles (default)
    satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 19
    }).addTo(map);
    
    // Labels overlay for satellite view (Google-style hybrid)
    labelsLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 19,
        pane: 'shadowPane'
    }).addTo(map);
    
    // Street tiles (alternative)
    streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    });
    
    // Initialize GPS tracking
    startGPSTracking();
    
    // Set up file upload handler
    document.getElementById('mapUpload').addEventListener('change', handleFileUpload);
    
    showToast('Map initialized - Ready to load data');
}

// ========================================
// GPS TRACKING
// ========================================

function startGPSTracking() {
    if (!navigator.geolocation) {
        updateGPSStatus('GPS not supported', '--', '--');
        return;
    }
    
    updateGPSStatus('Acquiring GPS...', '--', '--');
    
    navigator.geolocation.watchPosition(
        (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            updateGPSMarker();
            updateGPSStatus(
                'GPS Active',
                `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`,
                `±${Math.round(currentLocation.accuracy)}m`
            );
        },
        (error) => {
            console.error('GPS error:', error);
            updateGPSStatus('GPS Error: ' + error.message, '--', '--');
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );
}

function updateGPSMarker() {
    if (!currentLocation) return;
    
    if (locationMarker) {
        map.removeLayer(locationMarker);
    }
    
    // Create custom GPS marker
    const gpsIcon = L.divIcon({
        className: 'gps-marker',
        html: '<div style="width: 20px; height: 20px; background: #667eea; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    locationMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: gpsIcon,
        title: `GPS Location (±${Math.round(currentLocation.accuracy)}m)`
    }).addTo(map);
    
    // Add accuracy circle
    L.circle([currentLocation.lat, currentLocation.lng], {
        radius: currentLocation.accuracy,
        color: '#667eea',
        fillColor: '#667eea',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(map);
}

function updateGPSStatus(status, coords, accuracy) {
    document.getElementById('gpsStatus').textContent = status;
    document.getElementById('gpsCoords').textContent = coords;
    document.getElementById('gpsAccuracy').textContent = accuracy;
}

// ========================================
// FILE UPLOAD & PROCESSING
// ========================================

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    try {
        updateFileStatus('Loading file...');
        
        if (fileName.endsWith('.zip')) {
            await loadShapefile(file);
        } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
            await loadGeoJSON(file);
        } else if (fileName.endsWith('.kml')) {
            await loadKML(file);
        } else {
            throw new Error('Unsupported file type');
        }
        
    } catch (error) {
        console.error('File load error:', error);
        showToast('Error loading file: ' + error.message);
        updateFileStatus('Error loading file');
    }
}

async function loadGeoJSON(file) {
    const text = await file.text();
    const geojson = JSON.parse(text);
    
    displayDataLayer(geojson, file.name);
}

async function loadKML(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const kml = parser.parseFromString(text, 'text/xml');
    
    // Convert KML to GeoJSON using omnivore (already loaded in HTML)
    // For now, show error - need to implement KML parsing
    showToast('KML support coming soon - please convert to GeoJSON');
    updateFileStatus('KML not fully supported yet');
}

async function loadShapefile(file) {
    updateFileStatus('Processing shapefile...');
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Use shpjs library to parse shapefile
    const geojson = await shp(arrayBuffer);
    
    // Check if we need to reproject from EPSG:3857 to EPSG:4326
    if (geojson.features && geojson.features.length > 0) {
        const firstCoord = geojson.features[0].geometry.coordinates[0];
        
        // Check if coordinates look like Web Mercator (large numbers)
        if (Array.isArray(firstCoord)) {
            const testValue = Array.isArray(firstCoord[0]) ? firstCoord[0][0] : firstCoord[0];
            
            if (Math.abs(testValue) > 200) {
                // Likely EPSG:3857, reproject to EPSG:4326
                geojson.features.forEach(feature => {
                    if (feature.geometry.type === 'Polygon') {
                        feature.geometry.coordinates = feature.geometry.coordinates.map(ring =>
                            ring.map(coord => proj4('EPSG:3857', 'EPSG:4326', coord))
                        );
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        feature.geometry.coordinates = feature.geometry.coordinates.map(polygon =>
                            polygon.map(ring =>
                                ring.map(coord => proj4('EPSG:3857', 'EPSG:4326', coord))
                            )
                        );
                    }
                });
            }
        }
    }
    
    displayDataLayer(geojson, file.name);
}

// ========================================
// DATA LAYER DISPLAY
// ========================================

function displayDataLayer(geojson, filename) {
    // Remove existing data layer
    if (dataLayer) {
        map.removeLayer(dataLayer);
    }
    
    loadedData = geojson;
    
    // Count features and zones
    const featureCount = geojson.features ? geojson.features.length : 0;
    const zones = new Set();
    
    // Style function for zones
    function getStyle(feature) {
        const props = feature.properties;
        const zoneId = props.MUSYM || props.musym || props.Zone || props.zone || props.EC_ZONE || props.id;
        
        if (zoneId) zones.add(zoneId);
        
        // Color based on zone/soil type
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        const colorIndex = Math.abs(hashCode(String(zoneId))) % colors.length;
        
        return {
            fillColor: colors[colorIndex],
            weight: 2,
            opacity: 1,
            color: 'white',
            fillOpacity: 0.5
        };
    }
    
    // Add to map with popups
    dataLayer = L.geoJSON(geojson, {
        style: getStyle,
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const zoneId = props.MUSYM || props.musym || props.Zone || props.zone || props.EC_ZONE || props.id;
            
            // Create popup content
            let popupContent = '<div style="font-family: system-ui; padding: 8px;">';
            
            if (zoneId) {
                const soilInfo = getSoilInfo(zoneId);
                popupContent += `
                    <h3 style="margin: 0 0 10px 0; color: #667eea;">${zoneId}</h3>
                    <p style="margin: 4px 0;"><strong>Series:</strong> ${soilInfo.series}</p>
                    <p style="margin: 4px 0;"><strong>Texture:</strong> ${soilInfo.texture}</p>
                    <p style="margin: 4px 0;"><strong>Drainage:</strong> ${soilInfo.drainage}</p>
                    <p style="margin: 4px 0;"><strong>Slope:</strong> ${soilInfo.slope}</p>
                    <p style="margin: 4px 0;"><strong>pH Range:</strong> ${soilInfo.ph}</p>
                    <p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 12px; font-style: italic;">${soilInfo.cropNotes}</p>
                `;
            } else {
                // Show all properties if no zone ID
                popupContent += '<h3 style="margin: 0 0 10px 0; color: #667eea;">Feature Properties</h3>';
                for (let key in props) {
                    popupContent += `<p style="margin: 4px 0;"><strong>${key}:</strong> ${props[key]}</p>`;
                }
            }
            
            popupContent += '</div>';
            
            layer.bindPopup(popupContent);
        }
    }).addTo(map);
    
    // Zoom to layer bounds
    map.fitBounds(dataLayer.getBounds(), { padding: [50, 50] });
    
    // Update status
    const statusMsg = `${filename}: ${featureCount} features${zones.size > 0 ? `, ${zones.size} zones` : ''}`;
    updateFileStatus(statusMsg);
    updateMapInfo(statusMsg);
    showToast(`Loaded ${featureCount} features`);
}

// Helper function for consistent colors
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

// ========================================
// UI CONTROLS
// ========================================

function togglePanel() {
    const panel = document.getElementById('controlPanel');
    const content = document.getElementById('panelContent');
    const toggleBtn = document.getElementById('toggleBtn');
    const titleText = document.getElementById('panelTitleText');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        panel.classList.remove('panel-collapsed');
        toggleBtn.textContent = '−';
        titleText.textContent = 'Field Sampler';
    } else {
        content.style.display = 'none';
        panel.classList.add('panel-collapsed');
        toggleBtn.textContent = '+';
        titleText.textContent = '☰';
    }
}

function toggleSatellite() {
    const checked = document.getElementById('satelliteToggle').checked;
    
    if (checked) {
        // Switch to satellite + labels
        map.removeLayer(streetTiles);
        map.addLayer(satelliteTiles);
        map.addLayer(labelsLayer);
    } else {
        // Switch to street map
        map.removeLayer(satelliteTiles);
        map.removeLayer(labelsLayer);
        map.addLayer(streetTiles);
    }
}

function toggleZones() {
    const checked = document.getElementById('zonesToggle').checked;
    
    if (dataLayer) {
        if (checked) {
            map.addLayer(dataLayer);
        } else {
            map.removeLayer(dataLayer);
        }
    }
}

function toggleGPSMarker() {
    const checked = document.getElementById('gpsToggle').checked;
    
    if (locationMarker) {
        if (checked) {
            map.addLayer(locationMarker);
        } else {
            map.removeLayer(locationMarker);
        }
    }
}

function centerOnGPS() {
    if (currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 17);
        showToast('Centered on GPS');
    } else {
        showToast('No GPS location available');
    }
}

function zoomIn() {
    map.zoomIn();
}

function zoomOut() {
    map.zoomOut();
}

function clearMap() {
    if (confirm('Clear all loaded data?')) {
        if (dataLayer) {
            map.removeLayer(dataLayer);
            dataLayer = null;
            loadedData = null;
        }
        updateFileStatus('No data loaded');
        updateMapInfo('No data loaded');
        document.getElementById('mapUpload').value = '';
        showToast('Map data cleared');
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function updateFileStatus(text) {
    document.getElementById('fileStatus').textContent = text;
}

function updateMapInfo(text) {
    document.getElementById('mapInfo').textContent = text;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================================
// INITIALIZE ON LOAD
// ========================================

window.addEventListener('load', initMap);
