// ========================================
// KAS FIELD SAMPLER - CLEAN BUILD
// Core mapping functionality without database complexity
// ========================================

console.log('KAS Field Sampler app.js loading...');

// ========================================
// SOIL DATA LOOKUP - USDA API INTEGRATION
// ========================================

// Cache for API results to avoid redundant requests
// Clear cache on page load to ensure fresh data with latest query format
const soilDataCache = {};

// Clear old cached data on load
if (window.soilDataCache) {
    console.log('Clearing old soil data cache...');
    window.soilDataCache = {};
}

// Fetch soil data from USDA Soil Data Access API
async function fetchSoilDataFromUSDA(musym) {
    // Check cache first
    if (soilDataCache[musym]) {
        console.log(`Using cached data for ${musym}`);
        return soilDataCache[musym];
    }
    
    console.log(`Fetching soil data for MUSYM: ${musym}`);
    
    try {
        // USDA Soil Data Access API endpoint
        // Query to get ALL distinct soil components in a map unit
        // Use TOP 1 per component with GROUP BY on component name to avoid duplicates across multiple survey areas
        const query = `SELECT 
            mu.musym, mu.muname, 
            c.compname, 
            MAX(c.comppct_r) as comppct_r,
            MAX(c.taxclname) as taxclname,
            MAX(c.drainagecl) as drainagecl,
            MAX(c.slope_l) as slope_l, 
            MAX(c.slope_h) as slope_h,
            MAX(c.taxorder) as taxorder, 
            MAX(c.taxsuborder) as taxsuborder, 
            MAX(c.taxgrtgroup) as taxgrtgroup, 
            MAX(c.taxsubgrp) as taxsubgrp,
            MAX(c.cokey) as cokey
        FROM mapunit mu
        INNER JOIN component c ON c.mukey = mu.mukey
        WHERE mu.musym = '${musym}' AND c.comppct_r >= 3
        GROUP BY mu.musym, mu.muname, c.compname
        ORDER BY MAX(c.comppct_r) DESC`;
        
        console.log('SQL Query:', query);
        
        // Use URLSearchParams instead of FormData for proper form encoding
        const params = new URLSearchParams();
        params.append('query', query);
        params.append('format', 'JSON+COLUMNNAME');
        
        console.log('Sending request to USDA API...');
        
        const response = await fetch('https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response data:', data);
        
        // JSON+COLUMNNAME format: first row is column names, second row onwards is data
        if (data.Table && data.Table.length > 1) {
            const columns = data.Table[0]; // Column names
            
            console.log('Columns:', columns);
            console.log('Total rows returned:', data.Table.length - 1);
            console.log('Full data table:', data.Table);
            
            // Process ALL components (multiple soil types in one map unit)
            const components = [];
            const seenComponents = new Map(); // Track unique components by compname+percentage
            
            for (let i = 1; i < data.Table.length; i++) {
                const row = data.Table[i];
                const compname = row[2]; // component name
                const percentage = row[3]; // percentage
                const cokey = row[12]; // component key - unique identifier
                
                // Create a unique key based on component name and percentage
                const uniqueKey = `${compname}-${percentage}`;
                
                // Skip if we've already processed this exact component
                if (seenComponents.has(uniqueKey)) {
                    console.log(`Skipping duplicate: ${compname} (${percentage}%) - cokey ${cokey}`);
                    continue;
                }
                seenComponents.set(uniqueKey, cokey);
                
                console.log(`Processing component ${components.length + 1}: ${compname} (${percentage}%) - cokey ${cokey}`);
                console.log(`  Full row data:`, row);
                
                // Build taxonomic classification (the "Latin-ish" name)
                let taxonomicName = '';
                if (row[8]) taxonomicName = row[8]; // taxorder
                if (row[9]) taxonomicName += row[8] ? ` > ${row[9]}` : row[9]; // taxsuborder
                if (row[10]) taxonomicName += (row[8] || row[9]) ? ` > ${row[10]}` : row[10]; // taxgrtgroup
                if (row[11]) taxonomicName += (row[8] || row[9] || row[10]) ? ` > ${row[11]}` : row[11]; // taxsubgrp
                if (!taxonomicName && row[4]) taxonomicName = row[4]; // fallback to taxclname
                
                // We'll fetch PAWC separately for each component
                components.push({
                    series: row[2] || `Component ${components.length + 1}`, // compname
                    percentage: row[3] || 0, // comppct_r
                    muname: row[1] || '',
                    texture: row[4] ? row[4].split(',')[0] : 'Not available', // Extract texture from taxclname
                    drainage: row[5] || 'Not available',
                    slope: row[6] && row[7] ? `${row[6]}-${row[7]}%` : 'Variable',
                    taxonomicName: taxonomicName || 'Not available',
                    cokey: cokey,
                    pawc: 'Calculating...' // Will fetch this separately
                });
            }
            
            // Now fetch PAWC for each component
            for (let comp of components) {
                try {
                    const pawcQuery = `SELECT TOP 1 SUM(awc_r * (hzdepb_r - hzdept_r)) as pawc
                        FROM chorizon 
                        WHERE cokey = ${comp.cokey} AND hzdept_r < 150
                        GROUP BY cokey`;
                    
                    const pawcParams = new URLSearchParams();
                    pawcParams.append('query', pawcQuery);
                    pawcParams.append('format', 'JSON+COLUMNNAME');
                    
                    const pawcResponse = await fetch('https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: pawcParams.toString()
                    });
                    
                    if (pawcResponse.ok) {
                        const pawcData = await pawcResponse.json();
                        if (pawcData.Table && pawcData.Table.length > 1 && pawcData.Table[1][0]) {
                            comp.pawc = `${(pawcData.Table[1][0] / 10).toFixed(1)} inches`;
                        } else {
                            comp.pawc = 'Not available';
                        }
                    } else {
                        comp.pawc = 'Not available';
                    }
                } catch (error) {
                    console.error(`Error fetching PAWC for ${comp.series}:`, error);
                    comp.pawc = 'Not available';
                }
            }
            
            const soilInfo = {
                musym: musym,
                muname: components[0].muname,
                components: components,
                fetched: true
            };
            
            console.log('Parsed soil info with multiple components:', soilInfo);
            
            // Cache the result
            soilDataCache[musym] = soilInfo;
            return soilInfo;
        } else {
            console.warn('No data found in API response for', musym);
            // No data found, return minimal info
            const fallback = {
                musym: musym,
                muname: '',
                components: [{
                    series: `Map Unit ${musym}`,
                    percentage: 100,
                    muname: '',
                    texture: 'Data not available',
                    drainage: 'Data not available',
                    slope: 'Variable',
                    taxonomicName: 'Not available',
                    pawc: 'Not available'
                }],
                fetched: false
            };
            soilDataCache[musym] = fallback;
            return fallback;
        }
        
    } catch (error) {
        console.error('Error fetching soil data from USDA:', error);
        console.error('Error details:', error.message, error.stack);
        // Return minimal info on error
        const fallback = {
            musym: musym,
            muname: '',
            components: [{
                series: `Map Unit ${musym}`,
                percentage: 100,
                muname: '',
                texture: 'Unable to fetch',
                drainage: 'Unable to fetch',
                slope: 'Variable',
                taxonomicName: 'Unable to fetch',
                pawc: 'Unknown'
            }],
            fetched: false,
            error: true
        };
        soilDataCache[musym] = fallback;
        return fallback;
    }
}

// Main function to get soil info (now async)
async function getSoilInfo(musym) {
    return await fetchSoilDataFromUSDA(musym);
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
let ssurgoLayer = null;

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
        console.log('Loading file:', fileName);
        
        if (fileName.endsWith('.zip')) {
            await loadShapefile(file);
        } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
            await loadGeoJSON(file);
        } else if (fileName.endsWith('.kml')) {
            await loadKML(file);
        } else if (fileName.endsWith('.gpkg')) {
            await loadGeoPackage(file);
        } else {
            throw new Error('Unsupported file type. Use GeoJSON, KML, ZIP shapefile, or GPKG');
        }
        
        console.log('File loaded successfully');
        
    } catch (error) {
        console.error('File load error:', error);
        alert('Error loading file: ' + error.message);
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
    showToast('KML support coming soon - please convert to GeoJSON', 4000);
}

async function loadShapefile(file) {
    console.log('loadShapefile called with file:', file.name);
    
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    // Use shpjs library to parse shapefile
    console.log('Parsing shapefile with shpjs...');
    let parsed = await shp(arrayBuffer);
    console.log('Parsed result type:', Array.isArray(parsed) ? 'Array' : 'Object');
    
    // Handle both single GeoJSON and array of GeoJSON objects
    let geojson;
    if (Array.isArray(parsed)) {
        // If multiple shapefiles in ZIP, use the first one
        console.log('Multiple shapefiles found:', parsed.length);
        geojson = parsed[0];
    } else {
        geojson = parsed;
    }
    
    console.log('GeoJSON features:', geojson.features ? geojson.features.length : 0);
    
    // Check if we need to reproject from EPSG:3857 to EPSG:4326
    if (geojson.features && geojson.features.length > 0) {
        const firstCoord = geojson.features[0].geometry.coordinates[0];
        
        // Check if coordinates look like Web Mercator (large numbers)
        if (Array.isArray(firstCoord)) {
            const testValue = Array.isArray(firstCoord[0]) ? firstCoord[0][0] : firstCoord[0];
            
            if (Math.abs(testValue) > 200) {
                console.log('Reprojecting from EPSG:3857 to EPSG:4326...');
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

async function loadGeoPackage(file) {
    console.log('Loading GeoPackage:', file.name);
    
    // Check if SQL.js is available
    if (typeof initSqlJs === 'undefined') {
        throw new Error('SQL.js library not loaded. Check your internet connection and reload the page.');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log('Initializing SQL.js...');
    
    // Initialize SQL.js
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    
    console.log('Opening GeoPackage database...');
    
    // Open the database
    const db = new SQL.Database(uint8Array);
    
    // Find the geometry table
    console.log('Looking for geometry tables...');
    const tableQuery = db.exec("SELECT table_name FROM gpkg_geometry_columns LIMIT 1");
    if (!tableQuery.length || !tableQuery[0].values.length) {
        db.close();
        throw new Error('No geometry table found in GeoPackage. Make sure this is a valid .gpkg file.');
    }
    
    const tableName = tableQuery[0].values[0][0];
    console.log('Found table:', tableName);
    
    // Get all features
    console.log('Reading features...');
    const featuresQuery = db.exec(`SELECT * FROM "${tableName}"`);
    if (!featuresQuery.length) {
        db.close();
        throw new Error('No features found in table: ' + tableName);
    }
    
    console.log('Found', featuresQuery[0].values.length, 'features');
    
    // Convert to GeoJSON
    const columns = featuresQuery[0].columns;
    const rows = featuresQuery[0].values;
    
    console.log('Converting to GeoJSON...');
    console.log('Columns:', columns);
    
    const features = rows.map((row, idx) => {
        const properties = {};
        let geometry = null;
        
        row.forEach((value, index) => {
            const colName = columns[index].toLowerCase();
            // Common geometry column names
            if (colName === 'geom' || colName === 'geometry' || colName === 'shape' || colName === 'the_geom') {
                if (value) {
                    geometry = parseWKBGeometry(value);
                    if (!geometry) {
                        console.warn(`Failed to parse geometry for feature ${idx}`);
                    }
                }
            } else if (colName !== 'fid' && colName !== 'id') {
                properties[columns[index]] = value;
            }
        });
        
        if (!geometry) {
            console.warn(`Feature ${idx} has no valid geometry`);
        }
        
        return {
            type: 'Feature',
            properties: properties,
            geometry: geometry || { type: 'Point', coordinates: [0, 0] }
        };
    });
    
    const geojson = {
        type: 'FeatureCollection',
        features: features
    };
    
    console.log('GeoPackage conversion complete. Valid features:', features.filter(f => f.geometry && f.geometry.coordinates).length);
    
    db.close();
    displayDataLayer(geojson, file.name);
}

function parseWKBGeometry(wkb) {
    // WKB parser for GeoPackage geometries
    if (!wkb || wkb.length === 0) return null;
    
    try {
        const uint8 = new Uint8Array(wkb);
        const view = new DataView(uint8.buffer);
        
        let offset = 0;
        
        // Check for GeoPackage header (GP + version + flags)
        if (uint8[0] === 0x47 && uint8[1] === 0x50) {
            // Skip GeoPackage header (8 bytes) + SRS ID (4 bytes) + envelope
            const flags = uint8[3];
            const envelopeType = (flags >> 1) & 0x07;
            
            // Calculate envelope size
            const envelopeSizes = [0, 32, 48, 48, 64];
            const envelopeSize = envelopeSizes[envelopeType] || 0;
            
            offset = 8 + envelopeSize;
        }
        
        // Read WKB byte order and geometry type
        const byteOrder = uint8[offset];
        const isLittleEndian = byteOrder === 1;
        offset += 1;
        
        const geomType = view.getUint32(offset, isLittleEndian);
        offset += 4;
        
        // Parse based on geometry type
        if (geomType === 1) { // Point
            const x = view.getFloat64(offset, isLittleEndian);
            const y = view.getFloat64(offset + 8, isLittleEndian);
            return { type: 'Point', coordinates: [x, y] };
            
        } else if (geomType === 3) { // Polygon
            const numRings = view.getUint32(offset, isLittleEndian);
            offset += 4;
            const rings = [];
            
            for (let i = 0; i < numRings; i++) {
                const numPoints = view.getUint32(offset, isLittleEndian);
                offset += 4;
                const ring = [];
                
                for (let j = 0; j < numPoints; j++) {
                    const x = view.getFloat64(offset, isLittleEndian);
                    const y = view.getFloat64(offset + 8, isLittleEndian);
                    ring.push([x, y]);
                    offset += 16;
                }
                rings.push(ring);
            }
            
            return { type: 'Polygon', coordinates: rings };
            
        } else if (geomType === 6) { // MultiPolygon
            const numPolygons = view.getUint32(offset, isLittleEndian);
            offset += 4;
            const polygons = [];
            
            for (let p = 0; p < numPolygons; p++) {
                // Skip byte order and type for each polygon
                offset += 5;
                const numRings = view.getUint32(offset, isLittleEndian);
                offset += 4;
                const rings = [];
                
                for (let i = 0; i < numRings; i++) {
                    const numPoints = view.getUint32(offset, isLittleEndian);
                    offset += 4;
                    const ring = [];
                    
                    for (let j = 0; j < numPoints; j++) {
                        const x = view.getFloat64(offset, isLittleEndian);
                        const y = view.getFloat64(offset + 8, isLittleEndian);
                        ring.push([x, y]);
                        offset += 16;
                    }
                    rings.push(ring);
                }
                polygons.push(rings);
            }
            
            return { type: 'MultiPolygon', coordinates: polygons };
        }
        
        console.warn('Unsupported geometry type:', geomType);
        return null;
        
    } catch (e) {
        console.error('WKB parse error:', e);
        return null;
    }
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
    
    // Detect data type (EC zones vs soil vs generic)
    let dataType = 'generic';
    let zoneField = null;
    
    if (geojson.features && geojson.features.length > 0) {
        const firstProps = geojson.features[0].properties;
        if (firstProps.ec_zone || firstProps.EC_ZONE || firstProps.EC_Zone || 
            firstProps.zone || firstProps.Zone || firstProps.ZONE) {
            dataType = 'ec_zone';
            zoneField = firstProps.ec_zone ? 'ec_zone' : 
                       firstProps.EC_ZONE ? 'EC_ZONE' : 
                       firstProps.EC_Zone ? 'EC_Zone' :
                       firstProps.zone ? 'zone' :
                       firstProps.Zone ? 'Zone' : 'ZONE';
        } else if (firstProps.MUSYM || firstProps.musym) {
            dataType = 'ssurgo';
            zoneField = firstProps.MUSYM ? 'MUSYM' : 'musym';
        }
    }
    
    // Build color map FIRST
    const colorMap = {};
    let baseColors;
    
    if (dataType === 'ec_zone') {
        baseColors = {
            'A': '#DC143C',  // Red (Crimson)
            'B': '#DAA520',  // Tan/Yellow (Goldenrod)
            'C': '#32CD32',  // Green (Lime Green)
            'D': '#228B22',  // Dark Green (Forest Green)
            'E': '#4D96FF',  // Blue (if needed)
            'F': '#9D4EDD'   // Purple (if needed)
        };
    } else if (dataType === 'ssurgo') {
        baseColors = ['#8B4513', '#CD853F', '#DEB887', '#F4A460', '#D2691E', '#BC8F8F', '#DAA520', '#B8860B'];
    } else {
        baseColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    }
    
    let colorIndex = 0;
    
    // Build color map for each unique zone
    geojson.features.forEach(feature => {
        const zoneValue = zoneField ? feature.properties[zoneField] : null;
        if (zoneValue && !colorMap[zoneValue]) {
            zones.add(zoneValue);
            
            if (dataType === 'ec_zone' && typeof baseColors === 'object') {
                // Use predefined colors for EC zones (A, B, C, D)
                const zoneKey = String(zoneValue).toUpperCase();
                colorMap[zoneValue] = baseColors[zoneKey] || '#999999';
            } else if (Array.isArray(baseColors)) {
                colorMap[zoneValue] = baseColors[colorIndex % baseColors.length];
                colorIndex++;
            } else {
                colorMap[zoneValue] = '#999999';
            }
        }
    });
    
    // Style function - just looks up the color
    function getStyle(feature) {
        const zoneValue = zoneField ? feature.properties[zoneField] : '';
        const fillColor = colorMap[zoneValue] || '#BC8F8F';
        
        return {
            fillColor: fillColor,
            weight: 2,
            opacity: 1,
            color: dataType === 'ec_zone' ? '#000' : 'white',
            fillOpacity: 0.45
        };
    }
    
    // Add to map with popups
    dataLayer = L.geoJSON(geojson, {
        style: getStyle,
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            const zoneId = zoneField ? props[zoneField] : (props.id || props.name || props.Name);
            
            if (dataType === 'ec_zone' && zoneId) {
                // EC Zone popup with color box
                let popupContent = '<div style="font-family: system-ui; padding: 8px;">';
                popupContent += '<h4 style="margin: 0 0 8px 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 4px;">EC Zone Information</h4>';
                popupContent += `<div style="display: flex; align-items: center; margin-bottom: 8px;">`;
                popupContent += `<div style="width: 30px; height: 30px; background: ${colorMap[zoneId]}; border: 2px solid #000; border-radius: 4px; margin-right: 10px;"></div>`;
                popupContent += `<div style="font-size: 18px; font-weight: bold;">Zone ${zoneId}</div>`;
                popupContent += `</div>`;
                popupContent += '</div>';
                layer.bindPopup(popupContent);
                
            } else if (zoneId && dataType === 'ssurgo') {
                // SSURGO popup - async loading
                const loadingContent = `
                    <div style="font-family: system-ui; padding: 12px; min-width: 280px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <div style="font-size: 20px; font-weight: 600; color: #2c5282;">Map Unit ${zoneId}</div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #666;">
                            <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #667eea; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                            <div style="margin-top: 8px; font-size: 13px;">Loading soil data...</div>
                        </div>
                    </div>
                    <style>
                        @keyframes spin { to { transform: rotate(360deg); } }
                    </style>
                `;
                
                layer.bindPopup(loadingContent);
                
                // Fetch soil data asynchronously when popup opens
                layer.on('popupopen', async () => {
                    const soilInfo = await getSoilInfo(zoneId);
                    
                    // Build popup with component navigation if multiple components exist
                    const components = soilInfo.components || [];
                    const hasMultiple = components.length > 1;
                    
                    // Create unique ID for this popup
                    const popupId = `popup-${zoneId}-${Date.now()}`;
                    
                    // Function to build component display
                    const buildComponentHTML = (component, index, total) => {
                        return `
                            <div style="background: #f7fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                                ${hasMultiple ? `<div style="font-size: 11px; color: #667eea; font-weight: 600; margin-bottom: 6px;">Component ${index + 1} of ${total} (${component.percentage}% of map unit)</div>` : ''}
                                <div style="font-size: 15px; font-weight: 600; color: #2d3748; margin-bottom: 6px;">${component.series}</div>
                                ${component.taxonomicName && component.taxonomicName !== 'Not available' ? `<div style="font-size: 11px; color: #718096; font-style: italic; margin-bottom: 8px; line-height: 1.4;">${component.taxonomicName}</div>` : ''}
                                
                                <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13px; margin-top: 8px;">
                                    <div style="color: #4a5568; font-weight: 500;">Texture:</div>
                                    <div style="color: #2d3748;">${component.texture}</div>
                                    
                                    <div style="color: #4a5568; font-weight: 500;">Drainage:</div>
                                    <div style="color: #2d3748;">${component.drainage}</div>
                                    
                                    <div style="color: #4a5568; font-weight: 500;">Slope:</div>
                                    <div style="color: #2d3748;">${component.slope}</div>
                                    
                                    <div style="color: #4a5568; font-weight: 500;">PAWC:</div>
                                    <div style="color: #2d3748;">${component.pawc}</div>
                                </div>
                            </div>
                            
                            <a href="https://casoilresource.lawr.ucdavis.edu/sde/?series=${encodeURIComponent(component.series.split(' ')[0])}" 
                               target="_blank" 
                               style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; transition: background 0.2s; margin-bottom: 8px;"
                               onmouseover="this.style.background='#5568d3'" 
                               onmouseout="this.style.background='#667eea'">
                                <span>View Soil Profile & Details</span>
                                <span style="font-size: 16px;">›</span>
                            </a>
                        `;
                    };
                    
                    let popupContent = `
                        <div id="${popupId}" style="font-family: system-ui; padding: 12px; min-width: 300px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #667eea;">
                                <div style="font-size: 20px; font-weight: 600; color: #2c5282;">Map Unit ${zoneId}</div>
                                ${hasMultiple ? `<div style="font-size: 12px; color: #667eea; font-weight: 500;">${components.length} soils</div>` : ''}
                            </div>
                            ${soilInfo.muname ? `<div style="font-size: 12px; color: #718096; margin-bottom: 12px;">${soilInfo.muname}</div>` : ''}
                            
                            ${hasMultiple ? `
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                <button class="soil-nav-btn" data-popup-id="${popupId}" data-direction="-1" style="padding: 6px 12px; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; color: #4a5568;">‹</button>
                                <div style="flex: 1; text-align: center; font-size: 13px; color: #4a5568;" id="${popupId}-indicator">1 of ${components.length}</div>
                                <button class="soil-nav-btn" data-popup-id="${popupId}" data-direction="1" style="padding: 6px 12px; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; color: #4a5568;">›</button>
                            </div>
                            ` : ''}
                            
                            <div id="${popupId}-content">
                                ${buildComponentHTML(components[0], 0, components.length)}
                            </div>
                            
                            ${soilInfo.error ? '<div style="margin-top: 8px; padding: 8px; background: #fff5f5; border-left: 3px solid #fc8181; font-size: 11px; color: #c53030;">Unable to fetch complete data from USDA. Showing available information.</div>' : ''}
                        </div>
                    `;
                    
                    // Set up navigation state and event listeners
                    if (hasMultiple) {
                        window.soilPopupState = window.soilPopupState || {};
                        window.soilPopupState[popupId] = {
                            currentIndex: 0,
                            components: components,
                            buildHTML: buildComponentHTML
                        };
                    }
                    
                    layer.getPopup().setContent(popupContent);
                    
                    // Add event listeners after content is set (use setTimeout to ensure DOM is ready)
                    if (hasMultiple) {
                        setTimeout(() => {
                            const buttons = document.querySelectorAll('.soil-nav-btn');
                            buttons.forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    const btnPopupId = e.target.getAttribute('data-popup-id');
                                    const direction = parseInt(e.target.getAttribute('data-direction'));
                                    
                                    console.log('Navigation clicked:', btnPopupId, direction);
                                    
                                    const state = window.soilPopupState[btnPopupId];
                                    if (!state) {
                                        console.error('No state found for', btnPopupId);
                                        return;
                                    }
                                    
                                    state.currentIndex = (state.currentIndex + direction + state.components.length) % state.components.length;
                                    console.log('New index:', state.currentIndex);
                                    
                                    const contentDiv = document.getElementById(`${btnPopupId}-content`);
                                    const indicator = document.getElementById(`${btnPopupId}-indicator`);
                                    
                                    if (contentDiv && indicator) {
                                        contentDiv.innerHTML = state.buildHTML(state.components[state.currentIndex], state.currentIndex, state.components.length);
                                        indicator.textContent = `${state.currentIndex + 1} of ${state.components.length}`;
                                        console.log('Updated to component:', state.components[state.currentIndex].series);
                                    } else {
                                        console.error('Could not find content div or indicator');
                                    }
                                });
                            });
                        }, 100);
                    }
                });
                
            } else {
                // Show all properties if no zone ID
                let popupContent = '<div style="font-family: system-ui; padding: 8px;">';
                popupContent += '<h3 style="margin: 0 0 10px 0; color: #667eea;">Feature Properties</h3>';
                for (let key in props) {
                    popupContent += `<p style="margin: 4px 0;"><strong>${key}:</strong> ${props[key]}</p>`;
                }
                popupContent += '</div>';
                layer.bindPopup(popupContent);
            }
        }
    }).addTo(map);
    
    // Zoom to layer bounds
    map.fitBounds(dataLayer.getBounds(), { padding: [50, 50] });
    
    // Update status
    const statusMsg = `${filename}: ${featureCount} features${zones.size > 0 ? `, ${zones.size} zones` : ''}`;
    updateFileStatus(statusMsg);
    updateMapInfo(statusMsg);
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

function toggleSSURGO() {
    const checked = document.getElementById('ssurgoToggle').checked;
    
    if (checked) {
        if (!ssurgoLayer) {
            // Create SSURGO WMS layer from USDA Soil Data Access
            // Visual overlay only - use uploaded shapefiles for interactive data
            ssurgoLayer = L.tileLayer.wms('https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDM.wms', {
                layers: 'MapunitPoly',
                format: 'image/png',
                transparent: true,
                opacity: 0.5,
                attribution: 'USDA-NRCS Soil Survey',
                maxZoom: 19
            });
        }
        map.addLayer(ssurgoLayer);
    } else {
        if (ssurgoLayer) {
            map.removeLayer(ssurgoLayer);
        }
    }
}

// SSURGO click handler - currently disabled (visual overlay only)
// Use uploaded SSURGO shapefiles for interactive data with full component details
async function handleSSURGOClick_DISABLED(e) {
    // Only handle if SSURGO layer is active
    if (!ssurgoLayer || !map.hasLayer(ssurgoLayer)) {
        return;
    }
    
    const latlng = e.latlng;
    
    // Query WMS GetFeatureInfo to get the map unit symbol at clicked location
    const point = map.latLngToContainerPoint(latlng);
    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    // Format BBOX with proper precision
    const bbox = `${sw.lng.toFixed(6)},${sw.lat.toFixed(6)},${ne.lng.toFixed(6)},${ne.lat.toFixed(6)}`;
    
    const url = 'https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDM.wms' +
        '?SERVICE=WMS' +
        '&VERSION=1.1.1' +
        '&REQUEST=GetFeatureInfo' +
        '&LAYERS=MapunitPoly' +
        '&QUERY_LAYERS=MapunitPoly' +
        '&STYLES=' +
        '&INFO_FORMAT=text/html' +
        '&FEATURE_COUNT=1' +
        `&X=${Math.floor(point.x)}` +
        `&Y=${Math.floor(point.y)}` +
        '&SRS=EPSG:4326' +
        `&WIDTH=${size.x}` +
        `&HEIGHT=${size.y}` +
        `&BBOX=${bbox}`;
    
    try {
        console.log('Querying SSURGO WMS:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('WMS Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const contentType = response.headers.get('content-type');
        console.log('Response content type:', contentType);
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Parse HTML table response
            const text = await response.text();
            console.log('Response text:', text);
            
            // Parse HTML to extract MUSYM from table
            // The HTML has a table with columns: AREASYMBOL, SPATIALVERSION, MUSYM, etc.
            // We need the value in the MUSYM column (3rd column)
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            // Find all table cells
            const cells = doc.querySelectorAll('td');
            
            // The structure is: <td>AREASYMBOL</td><td>SPATIALVERSION</td><td>MUSYM</td>...
            // So MUSYM is at index 2 (0-based)
            if (cells.length >= 3) {
                const musym = cells[2].textContent.trim();
                console.log('Found MUSYM from HTML table:', musym);
                
                if (musym) {
                    data = { features: [{ properties: { musym: musym } }] };
                } else {
                    throw new Error('MUSYM field is empty');
                }
            } else {
                throw new Error('Could not find MUSYM in HTML table - not enough cells');
            }
        }
        
        console.log('Parsed data:', data);
        
        if (data.features && data.features.length > 0) {
            const musym = data.features[0].properties.musym;
            console.log('Found MUSYM:', musym);
            
            // Show loading popup
            const loadingPopup = L.popup()
                .setLatLng(latlng)
                .setContent('<div style="padding: 10px; text-align: center;">Loading soil data...</div>')
                .openOn(map);
            
            // Fetch soil info and show detailed popup
            const soilInfo = await getSoilInfo(musym);
            
            // Build popup similar to uploaded data
            const components = soilInfo.components || [];
            const hasMultiple = components.length > 1;
            const popupId = `popup-ssurgo-${musym}-${Date.now()}`;
            
            const buildComponentHTML = (component, index, total) => {
                return `
                    <div style="background: #f7fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                        ${hasMultiple ? `<div style="font-size: 11px; color: #667eea; font-weight: 600; margin-bottom: 6px;">Component ${index + 1} of ${total} (${component.percentage}% of map unit)</div>` : ''}
                        <div style="font-size: 15px; font-weight: 600; color: #2d3748; margin-bottom: 6px;">${component.series}</div>
                        ${component.taxonomicName && component.taxonomicName !== 'Not available' ? `<div style="font-size: 11px; color: #718096; font-style: italic; margin-bottom: 8px; line-height: 1.4;">${component.taxonomicName}</div>` : ''}
                        
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13px; margin-top: 8px;">
                            <div style="color: #4a5568; font-weight: 500;">Texture:</div>
                            <div style="color: #2d3748;">${component.texture}</div>
                            
                            <div style="color: #4a5568; font-weight: 500;">Drainage:</div>
                            <div style="color: #2d3748;">${component.drainage}</div>
                            
                            <div style="color: #4a5568; font-weight: 500;">Slope:</div>
                            <div style="color: #2d3748;">${component.slope}</div>
                            
                            <div style="color: #4a5568; font-weight: 500;">PAWC:</div>
                            <div style="color: #2d3748;">${component.pawc}</div>
                        </div>
                    </div>
                    
                    <a href="https://casoilresource.lawr.ucdavis.edu/sde/?series=${encodeURIComponent(component.series.split(' ')[0])}" 
                       target="_blank" 
                       style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500; transition: background 0.2s; margin-bottom: 8px;"
                       onmouseover="this.style.background='#5568d3'" 
                       onmouseout="this.style.background='#667eea'">
                        <span>View Soil Profile & Details</span>
                        <span style="font-size: 16px;">›</span>
                    </a>
                `;
            };
            
            let popupContent = `
                <div id="${popupId}" style="font-family: system-ui; padding: 12px; min-width: 300px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #667eea;">
                        <div style="font-size: 20px; font-weight: 600; color: #2c5282;">Map Unit ${musym}</div>
                        ${hasMultiple ? `<div style="font-size: 12px; color: #667eea; font-weight: 500;">${components.length} soils</div>` : ''}
                    </div>
                    ${soilInfo.muname ? `<div style="font-size: 12px; color: #718096; margin-bottom: 12px;">${soilInfo.muname}</div>` : ''}
                    
                    ${hasMultiple ? `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <button class="soil-nav-btn-ssurgo" data-popup-id="${popupId}" data-direction="-1" style="padding: 6px 12px; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; color: #4a5568;">‹</button>
                        <div style="flex: 1; text-align: center; font-size: 13px; color: #4a5568;" id="${popupId}-indicator">1 of ${components.length}</div>
                        <button class="soil-nav-btn-ssurgo" data-popup-id="${popupId}" data-direction="1" style="padding: 6px 12px; background: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; font-size: 18px; color: #4a5568;">›</button>
                    </div>
                    ` : ''}
                    
                    <div id="${popupId}-content">
                        ${buildComponentHTML(components[0], 0, components.length)}
                    </div>
                </div>
            `;
            
            loadingPopup.setContent(popupContent);
            
            // Set up navigation for multiple components
            if (hasMultiple) {
                window.soilPopupState = window.soilPopupState || {};
                window.soilPopupState[popupId] = {
                    currentIndex: 0,
                    components: components,
                    buildHTML: buildComponentHTML
                };
                
                setTimeout(() => {
                    const buttons = document.querySelectorAll('.soil-nav-btn-ssurgo');
                    buttons.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const btnPopupId = e.target.getAttribute('data-popup-id');
                            const direction = parseInt(e.target.getAttribute('data-direction'));
                            
                            const state = window.soilPopupState[btnPopupId];
                            if (!state) return;
                            
                            state.currentIndex = (state.currentIndex + direction + state.components.length) % state.components.length;
                            
                            const contentDiv = document.getElementById(`${btnPopupId}-content`);
                            const indicator = document.getElementById(`${btnPopupId}-indicator`);
                            
                            if (contentDiv && indicator) {
                                contentDiv.innerHTML = state.buildHTML(state.components[state.currentIndex], state.currentIndex, state.components.length);
                                indicator.textContent = `${state.currentIndex + 1} of ${state.components.length}`;
                            }
                        });
                    });
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error querying SSURGO layer:', error);
        L.popup()
            .setLatLng(latlng)
            .setContent('<div style="padding: 10px;">Unable to fetch soil data at this location.</div>')
            .openOn(map);
    }
}

function centerOnGPS() {
    if (currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 17);
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
        updateFileStatus('Supports: GeoJSON, KML, Shapefiles (ZIP), GeoPackage');
        updateMapInfo('No data loaded');
        document.getElementById('mapUpload').value = '';
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

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ========================================
// INITIALIZE ON LOAD
// ========================================

window.addEventListener('load', initMap);
