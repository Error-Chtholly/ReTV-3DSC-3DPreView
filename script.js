// ================= 配置区 =================
// DATA_URL 依然保留，专门用来给“下载按钮”提供完整版 JSON 文件的下载路径
let DATA_URL = './lod1_dataset/kunming.json'; 

// 新增：分块数据读取配置
let CHUNK_DIR = './lod1_dataset/kunming/'; // 分块文件夹路径
let CHUNK_PREFIX = 'kunming_part_';               // 分块文件前缀

const HEIGHT_FIELD = 'pred_heigh'; 
const ID_FIELD = 'TARGET_FID';
// ==========================================

// 核心全局变量
let scene, camera, renderer, controls;
let mergedCityData = null; // 新增：用于缓存合并后的完整城市 JSON 数据
let cityGroup = new THREE.Group();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredMesh = null;
let gridHelper = null; 
const clock = new THREE.Clock(); 
let originalFogDensity = 0.0015; 

// ====== 新增：存储真实坐标逆向推演需要的全局变量 ======
let globalLocalOrigin = null; 
let globalCityOffset = { x: 0, z: 0 };
let baseMapPlane = null; // 底图平面实例

// 【修复新增】：记录初始相机状态，用于“重置视角”
let initialCameraState = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
// =====================================================

// ====== 新增：防拖拽误触变量 ======
let pointerDownX = 0;
let pointerDownY = 0;
// ==================================

// 特效参数传递
const uniforms = {
    uTime: { value: 0 },
    uRippleEnabled: { value: true }
};

const infoPanel = document.getElementById('info-panel');
const bldIdText = document.getElementById('bld-id');
const bldHeightText = document.getElementById('bld-height');
const bldCoordsText = document.getElementById('bld-coords');

init();
bindUIEvents(); 
startClockUI(); // 启动时钟

function startClockUI() {
    setInterval(() => {
        const clockEl = document.getElementById('realtime-clock');
        if (clockEl) {
            const now = new Date();
            // 【修复3】：时间显示增加 年-月-日
            const dateStr = now.getFullYear() + '-' + 
                            (now.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                            now.getDate().toString().padStart(2, '0');
            const timeStr = now.getHours().toString().padStart(2, '0') + ':' + 
                            now.getMinutes().toString().padStart(2, '0') + ':' + 
                            now.getSeconds().toString().padStart(2, '0');
            clockEl.innerText = dateStr + ' ' + timeStr;
        }
    }, 1000);
}

// 【修复新增】：动态注入响应式 CSS，解决窗口缩小后 UI 和文字重叠问题，并居中所有按钮文字
// 【修复新增】：动态注入响应式 CSS，解决窗口缩小后 UI 和文字重叠问题，并居中所有按钮文字
function injectResponsiveCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ====== 【新增修复】：强制时钟字体与整体 UI 统一 ====== */
        #realtime-clock {
            font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        /* ======================================================== */

        /* 【样式修复】：强制所有按钮中的文字和图标上下左右完全居中 */
        button {
            display: inline-flex !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
            line-height: 1 !important;
            box-sizing: border-box !important;
        }

        /* 【样式修复】：主按钮统一放大图标，配合无文字设计 */
        #btn-camera, #btn-download, #btn-settings, #btn-about, #btn-reset, #btn-fullscreen, #btn-chart {
            font-size: 20px !important;
        }

        @media screen and (max-width: 768px) {
            /* 左上角标题区域 */
            .ui-container, .top-left-ui {
                position: absolute !important;
                top: 10px !important;
                left: 10px !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                gap: 8px !important;
                z-index: 10 !important;
                background: rgba(0, 0, 0, 0.5) !important;
                padding: 10px !important;
                border-radius: 8px !important;
                width: calc(100vw - 20px) !important; /* 撑满屏幕宽度防截断 */
                box-sizing: border-box !important;
            }
            
            /* 【核心修复】：将控制按钮强制下移，排在标题下方避开重叠 */
            .controls-container {
                position: absolute !important;
                top: 90px !important; /* 向下偏移 90px 避开上面的标题 */
                left: 10px !important; /* 改为靠左对齐 */
                right: auto !important; /* 取消靠右对齐 */
                display: flex !important;
                flex-wrap: wrap !important;
                justify-content: flex-start !important; /* 按钮靠左排列 */
                gap: 5px !important;
                z-index: 10 !important;
                background: rgba(0, 0, 0, 0.5) !important; /* 加个统一底色更清晰 */
                padding: 8px !important;
                border-radius: 8px !important;
                width: calc(100vw - 20px) !important;
                box-sizing: border-box !important;
            }

            /* 底部信息面板 */
            #info-panel {
                top: auto !important;
                bottom: 20px !important;
                left: 10px !important;
                width: calc(100vw - 20px) !important;
                transform: none !important;
                z-index: 20 !important;
                box-sizing: border-box !important;
            }
            
            /* 缩小元素避免拥挤 */
            button, select {
                font-size: 16px !important; /* 手机端图标大一点好点 */
                padding: 6px 8px !important;
                margin: 2px !important;
            }
            #realtime-clock, #loading-text {
                font-size: 12px !important;
                margin: 2px 0 !important;
                line-height: 1.2 !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function init() {
    injectResponsiveCSS(); // 注入防重叠布局与居中样式

    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a16, originalFogDensity);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 800, 1200);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 【无损性能优化】：锁定最大像素比为1.5，避免 2K/4K 屏幕上进行超高倍率无效渲染导致严重卡顿
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); 
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(500, 1000, 500);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x00f3ff, 0.5); 
    backLight.position.set(-500, 500, -500);
    scene.add(backLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    scene.add(cityGroup);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);

    // 【全新修改】：使用 Pointer Events 统一处理电脑点击和手机触摸
    renderer.domElement.addEventListener('pointerdown', onPointerDown, false);
    renderer.domElement.addEventListener('pointerup', onPointerUp, false);

    loadCityData();
    animate();
}

async function loadCityData() {
    try {
        const loadingText = document.getElementById('loading-text');
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';

        let chunkIndex = 1;
        let hasMoreChunks = true;
        const allFeatures = [];
        let baseGeoJsonMeta = null;

        // 循环拉取所有分块文件，直到 fetch 返回 404
        while (hasMoreChunks) {
            // 构造文件名，例如 kunming_part_001.json
            const chunkId = chunkIndex.toString().padStart(3, '0');
            const chunkUrl = `${CHUNK_DIR}${CHUNK_PREFIX}${chunkId}.json`;

            loadingText.innerText = `⏳ 正在下载分块数据: ${chunkUrl.split('/').pop()}...`;
            
            try {
                const response = await fetch(chunkUrl);
                
                // 如果返回的不是 200 OK（比如 404 找不到文件），说明分块读完了，跳出循环
                if (!response.ok) {
                    hasMoreChunks = false;
                    break; 
                }
                
                const geojsonData = await response.json();
                
                // 第一次读取时，保存 geojson 的头部信息（如 type: "FeatureCollection"）
                if (!baseGeoJsonMeta) {
                    baseGeoJsonMeta = { ...geojsonData };
                    delete baseGeoJsonMeta.features;
                }
                
                // 将当前块的建筑数据推入总数组
                if (geojsonData.features) {
                    allFeatures.push(...geojsonData.features);
                } else if (Array.isArray(geojsonData)) {
                    allFeatures.push(...geojsonData);
                }

                chunkIndex++;
            } catch (e) {
                // 发生网络或解析错误，当作没有更多分块了
                hasMoreChunks = false;
                break;
            }
        }

        if (allFeatures.length === 0) {
            throw new Error("未能加载到任何分块数据");
        }

        loadingText.innerText = `📦 分块合并完毕！共 ${allFeatures.length} 栋建筑，准备三维重建...`;
        
        // 组装回完整的 GeoJSON 对象，传给原来的 buildCity 去建模
        const finalData = baseGeoJsonMeta || { type: "FeatureCollection" };
        finalData.features = allFeatures;

        // ================= 新增这行代码 =================
        mergedCityData = finalData; // 把合并好的完整数据缓存起来
        // ==============================================

        await buildCity(finalData);
        
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.style.display = 'none', 800);

    } catch (error) {
        document.getElementById('loading-text').innerText = "❌ 分块加载失败，请检查文件夹路径";
        document.getElementById('loading-text').style.color = "red";
        console.error("加载出错:", error);
    }
}

// 投影算法
function projectToWebMercator(lon, lat) {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
}

// ====== 新增：逆投影算法 (用于在悬浮窗显示真实经纬度) ======
function inverseWebMercator(x, y) {
    const lon = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return [lon, lat];
}
// ========================================================

async function buildCity(data) {
    if (!data.features) return;

    const box = new THREE.Box3(); 

    const defaultMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x28385e,       
        roughness: 0.7, 
        metalness: 0.2,
        side: THREE.DoubleSide 
    });

    // --- 修改点：注入改良后的单波纹周期轮询 Shader 特效，降低光效亮度 ---
    defaultMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uRippleEnabled = uniforms.uRippleEnabled;
        
        shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
        `.replace(
            `#include <worldpos_vertex>`,
            `#include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
        
        shader.fragmentShader = `
            uniform float uTime;
            uniform bool uRippleEnabled;
            varying vec3 vWorldPos;
            ${shader.fragmentShader}
        `.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            if(uRippleEnabled){
                float dist = length(vWorldPos.xz);
                
                // 【修复】：大幅提升流光速度 (800 -> 3000)
                float speed = 3000.0;
                float cycle = 12000.0; 
                float radius = mod(uTime * speed, cycle);
                
                // 使用 smoothstep 限定这道流光的宽度 (150单位)
                float thickness = 150.0;
                float wave = 1.0 - smoothstep(0.0, thickness, abs(dist - radius));
                
                // 大幅调低亮度 multiplier 由 1.5 降至 0.35 变得更为内敛护眼
                vec3 rippleColor = vec3(0.0, 0.8, 1.0) * wave * 0.35; 
                gl_FragColor.rgb += rippleColor;
            }
            `
        );
    };
    
    const features = data.features;
    const total = features.length;
    let localOrigin = null; 

    await new Promise((resolve) => {
        let currentIndex = 0;
        const chunkSize = 300; 

        function processChunk() {
            const end = Math.min(currentIndex + chunkSize, total);
            
            for (let idx = currentIndex; idx < end; idx++) {
                const feature = features[idx];
                const height = feature.properties[HEIGHT_FIELD] || 10;
                const bldId = feature.properties[ID_FIELD] || "Unknown";
                
                let polygons = [];
                if (feature.geometry.type === 'Polygon') {
                    polygons.push(feature.geometry.coordinates);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    polygons = feature.geometry.coordinates;
                }

                polygons.forEach(polygonCoords => {
                    const shape = new THREE.Shape();
                    const exteriorRing = polygonCoords[0]; 

                    for (let i = 0; i < exteriorRing.length; i++) {
                        let [lon, lat] = exteriorRing[i];
                        let [x, y] = projectToWebMercator(lon, lat);

                        if (!localOrigin) {
                            localOrigin = [x, y];
                            globalLocalOrigin = localOrigin; // 记录给悬浮窗反算使用
                        }
                        x -= localOrigin[0];
                        y -= localOrigin[1];

                        if (i === 0) shape.moveTo(x, y);
                        else shape.lineTo(x, y);
                    }

                    if (polygonCoords.length > 1) {
                        for (let i = 1; i < polygonCoords.length; i++) {
                            const holeRing = polygonCoords[i];
                            const holePath = new THREE.Path();
                            for (let j = 0; j < holeRing.length; j++) {
                                let [lon, lat] = holeRing[j];
                                let [x, y] = projectToWebMercator(lon, lat);
                                x -= localOrigin[0];
                                y -= localOrigin[1];
                                if (j === 0) holePath.moveTo(x, y);
                                else holePath.lineTo(x, y);
                            }
                            shape.holes.push(holePath);
                        }
                    }

                    const extrudeSettings = {
                        depth: height,
                        bevelEnabled: false, 
                        curveSegments: 1, 
                        steps: 1 
                    };

                    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    geometry.rotateX(-Math.PI / 2);
                    
                    geometry.computeBoundingBox();
                    box.union(geometry.boundingBox);

                    const clonedMaterial = defaultMaterial.clone();
                    clonedMaterial.onBeforeCompile = defaultMaterial.onBeforeCompile;
                    
                    const mesh = new THREE.Mesh(geometry, clonedMaterial);
                    mesh.matrixAutoUpdate = false;
                    mesh.updateMatrix();

                    // ====== 新增：计算建筑占地面积与体量 ======
                    let baseArea = 0;
                    try {
                        // 获取轮廓顶点并计算面积 (Three.js 提供的工具函数)
                        baseArea = Math.abs(THREE.ShapeUtils.area(shape.getPoints()));
                        // 如果有挖洞 (例如中庭)，减去空洞的面积
                        if (shape.holes && shape.holes.length > 0) {
                            shape.holes.forEach(hole => {
                                baseArea -= Math.abs(THREE.ShapeUtils.area(hole.getPoints()));
                            });
                        }
                    } catch (e) {
                        baseArea = 0; // 容错处理
                    }
                    let bldVolume = baseArea * height; // 体量 = 底面积 × 高度

                    mesh.userData = {
                        id: bldId,
                        height: height,
                        area: baseArea,
                        volume: bldVolume,
                        baseColor: 0x28385e
                    };
                    cityGroup.add(mesh);
                });
            }

            currentIndex = end;
            const percent = ((currentIndex / total) * 100).toFixed(2);
            document.getElementById('loading-text').innerText = `🔨 正在建模中: ${percent}% (${currentIndex}/${total})`;

            if (currentIndex < total) setTimeout(processChunk, 0); 
            else resolve(); 
        }
        processChunk();
    });

    const center = new THREE.Vector3();
    box.getCenter(center);
    
    cityGroup.position.x = -center.x;
    cityGroup.position.z = -center.z; 
    cityGroup.position.y = -box.min.y;

    // 记录 CityGroup 最终偏移，用于射线检测时的经纬度逆推算
    globalCityOffset.x = -center.x;
    globalCityOffset.z = -center.z;

    const sizeX = box.max.x - box.min.x;
    const sizeZ = box.max.z - box.min.z;
    const maxSize = Math.max(sizeX, sizeZ);
    
    originalFogDensity = 1.5 / maxSize;
    if (document.getElementById('toggle-fog').checked) {
        scene.fog.density = originalFogDensity; 
    } else {
        scene.fog.density = 0;
    }

    camera.far = maxSize * 3 + 10000; 
    camera.updateProjectionMatrix();
    
    // 【修改点】：设置相机的同时，将当前设定保存为初始状态
    camera.position.set(0, maxSize * 0.6, maxSize * 0.8);
    controls.target.set(0, 0, 0);
    controls.update();

    initialCameraState.pos.copy(camera.position);
    initialCameraState.target.copy(controls.target);

    gridHelper = new THREE.GridHelper(maxSize * 1.5, 100, 0x00f3ff, 0x223344);
    gridHelper.position.y = -0.1;
    gridHelper.visible = document.getElementById('toggle-grid').checked;
    scene.add(gridHelper);

    // ====== 【修复】：动态自适应构建与刷新地图底板平面 ======
    if (!baseMapPlane) {
        // 初始大小先给 1，稍后统一缩放
        const planeGeo = new THREE.PlaneGeometry(1, 1);
        const planeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, visible: false, roughness: 1.0 });
        baseMapPlane = new THREE.Mesh(planeGeo, planeMat);
        baseMapPlane.rotation.x = -Math.PI / 2;
        baseMapPlane.position.y = -1.0;
        scene.add(baseMapPlane);
    }

    // 关键修复 1：每次渲染新城市，强制更新底图的大小以包围整个城市
    baseMapPlane.scale.set(maxSize * 4, maxSize * 4, 1);

    // 关键修复 2：刚加载完城市，立即读取 HTML 下拉框的当前值，强制同步一次！
    const currentBasemap = document.getElementById('basemap-select') ? document.getElementById('basemap-select').value : 'none';
    applyBasemap(currentBasemap);
    // ========================================================

    console.log(`✅ 成功渲染 ${total} 栋建筑`);
}

// ==========================================================

// 新增全局变量
let autoRotateEnabled = false;
let currentLang = 'zh';

// 国际化双语字典
const i18nDict = {
    zh: {
        loading: "正在构建三维城市网络...", subtitle: "Interactive 3D City Digital Twin",
        mapNone: "地图底板: 无", mapWhite: "地图底板: 白色", mapBlack: "地图底板: 黑色", mapSatellite: "地图底板: 在线遥感",
        btnCamera: "📷", btnDownload: "📥", btnSettings: "⚙️", btnAbout: "ℹ️",
        infoHeight: "高度 (Height):", infoCoords: "经纬度 (Lon, Lat):",
        hintLeft: "左键", hintLeftDesc: "旋转视角", hintRight: "右键", hintRightDesc: "平移地图",
        hintScroll: "滚轮", hintScrollDesc: "缩放城市", hintHover: "悬停", hintHoverDesc: "查看属性",
        settingsTitle: "⚙️ 场景控制台", setLang: "🌐 界面语言 (Language)", setFullscreen: "🖥️ 全屏模式",
        setRipple: "🌊 动态波纹特效", setFog: "🌫️ 远景科技雾", setGrid: "🕸️ 底部网格投影", setAutoRotate: "🚁 自动漫游模式",
        aboutTitle: "ℹ️ 关于及版权信息",
        aboutText1: "本系统依托于《XXXXXX》论文研究成果开发 (注：请将此处替换为您的PDF论文真实标题)。",
        aboutText2: "版权所有 © 2024-2026 研究团队。保留所有权利。",
        aboutText3: "如需引用本系统及相关算法，请参考上述文献，未经授权不得用于商业用途。",
        // ===== 新增图表翻译 =====
        chartTitle: "📊 城市建筑数据多维统计",
        chartTitleHeight: "📈 高度统计",
        chartTitleArea: "📉 面积统计",
        chartTitleVolume: "🧊 体量统计",
        chartClose: "关闭 (Close)",
        chartNoData: "暂无建筑数据加载"
    },
    en: {
        loading: "Building 3D Urban Network...", subtitle: "Interactive 3D City Digital Twin",
        mapNone: "Basemap: None", mapWhite: "Basemap: White", mapBlack: "Basemap: Black", mapSatellite: "Basemap: Online Sat",
        btnCamera: "📷", btnDownload: "📥", btnSettings: "⚙️", btnAbout: "ℹ️",
        infoHeight: "Height:", infoCoords: "Coordinates:",
        hintLeft: "L-Click", hintLeftDesc: "Rotate", hintRight: "R-Click", hintRightDesc: "Pan",
        hintScroll: "Scroll", hintScrollDesc: "Zoom", hintHover: "Hover", hintHoverDesc: "Inspect",
        settingsTitle: "⚙️ Console", setLang: "🌐 Language", setFullscreen: "🖥️ Fullscreen",
        setRipple: "🌊 Dynamic Ripple", setFog: "🌫️ Tech Fog", setGrid: "🕸️ Base Grid", setAutoRotate: "🚁 Auto-Rotate",
        aboutTitle: "ℹ️ About & Copyright",
        aboutText1: "This system is developed based on the paper <XXXXXX> (Please replace with actual PDF title).",
        aboutText2: "Copyright © 2024-2026 Research Team. All rights reserved.",
        aboutText3: "For citations, please refer to the literature. No unauthorized commercial use.",
        // ===== 新增图表翻译 =====
        chartTitle: "📊 City Building Multi-dimensional Stats",
        chartTitleHeight: "📈 Height Stats",
        chartTitleArea: "📉 Area Stats",
        chartTitleVolume: "🧊 Volume Stats",
        chartClose: "Close",
        chartNoData: "No building data loaded"
    }
};

function switchLanguage(lang) {
    currentLang = lang;
    const dict = i18nDict[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(dict[key]) el.innerText = dict[key];
    });

    // 【修复1】：动态将城市下拉列表中的城市名称进行中英转换
    // 原理：在切换英文时，自动将 value (如 kunming) 首字母大写转为 Kunming。回切中文时恢复原样。
    const citySelect = document.getElementById('city-select');
    if (citySelect) {
        Array.from(citySelect.options).forEach(opt => {
            if (!opt.dataset.origText) opt.dataset.origText = opt.text; // 备份原始中文
            if (lang === 'en') {
                // 将 value (如 "new_york" 或 "kunming") 转成首字母大写的纯英文
                opt.text = opt.value.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            } else {
                opt.text = opt.dataset.origText; // 恢复中文
            }
        });
    }
}

// 【新增】：相机平滑飞行函数
function resetCameraSmoothly(targetPos, targetLookAt, duration = 1200) {
    // 记录起点状态
    const startPos = camera.position.clone();
    const startLookAt = controls.target.clone();
    const startTime = performance.now();

    function animateTransition(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 缓动函数 (easeInOutCubic) - 让动画首尾平滑，中间加速
        const ease = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // 对相机位置和控制中心点进行插值计算
        camera.position.lerpVectors(startPos, targetPos, ease);
        controls.target.lerpVectors(startLookAt, targetLookAt, ease);
        
        // 必须更新控制器
        controls.update();

        // 没结束就继续下一帧
        if (progress < 1) {
            requestAnimationFrame(animateTransition);
        }
    }
    
    // 启动动画
    requestAnimationFrame(animateTransition);
}

function bindUIEvents() {
    // ====== 新增：阻止画布区域的右键默认菜单和原生鼠标手势 ======
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.addEventListener('contextmenu', function (event) {
            event.preventDefault(); // 拦截默认右键菜单
        }, false);
    }
    // =========================================================

    // 【样式修复】：强制去除所有主按钮初始可能存在的文字描述，只留下稍大的图标
    const iconMap = {
        'btn-camera': '📷',
        'btn-download': '📥',
        'btn-settings': '⚙️',
        'btn-about': 'ℹ️',
        'btn-fullscreen': '🖥️'
    };
    for (let id in iconMap) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerHTML = iconMap[id];
            // 增加 title 提示弥补无字设计带来的功能识别度下降
            btn.title = btn.title || id.replace('btn-', ''); 
        }
    }

    // 城市切换与下载
    document.getElementById('city-select').addEventListener('change', (e) => {
        const cityName = e.target.value; // e.g., 'kunming'
        
        // 【关键修改】：同步更新完整下载路径 和 分块读取路径
        DATA_URL = `./lod1_dataset/${cityName}.json`; 
        CHUNK_DIR = `./lod1_dataset/${cityName}/`;
        CHUNK_PREFIX = `${cityName}_part_`;

        // ================= 新增这行代码 =================
        mergedCityData = null; // 切换城市时，清空上一个城市的完整数据缓存
        // ==============================================

        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        
        while(cityGroup.children.length > 0) {
            const mesh = cityGroup.children[0];
            cityGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        if (gridHelper) {
            scene.remove(gridHelper);
            gridHelper.material.dispose();
            gridHelper = null;
        }
        globalLocalOrigin = null;
        loadCityData();
    });

    document.getElementById('btn-download').addEventListener('click', () => {
        // 如果数据还没加载完就点击了下载，给个提示
        if (!mergedCityData) {
            alert(currentLang === 'zh' ? "数据仍在加载或拼接中，请稍后再试！" : "Data is still loading, please try again later!");
            return;
        }

        // 1. 将内存中合并好的完整对象转为 JSON 字符串
        const jsonString = JSON.stringify(mergedCityData);
        
        // 2. 将字符串转换为 Blob (二进制大对象)
        const blob = new Blob([jsonString], { type: "application/json" });
        
        // 3. 为 Blob 创建一个本地临时的 URL 对象
        const localUrl = URL.createObjectURL(blob);

        // 4. 触发隐藏的 a 标签下载
        const link = document.createElement('a');
        link.href = localUrl;
        // 依然保留使用 DATA_URL 的末尾作为默认下载文件名（如 'kunming.json'）
        link.download = DATA_URL.split('/').pop(); 
        document.body.appendChild(link);
        link.click();
        
        // 5. 延迟清理：移除 DOM 元素并释放内存中的 URL
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(localUrl), 100);
    });

    // 设置与关于模态框
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('btn-settings').addEventListener('click', () => {
        settingsModal.classList.remove('hidden-modal');
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        settingsModal.classList.add('hidden-modal');
    });

    const aboutModal = document.getElementById('about-modal');
    document.getElementById('btn-about').addEventListener('click', () => {
        aboutModal.classList.remove('hidden-modal');
    });
    document.getElementById('btn-close-about').addEventListener('click', () => {
        aboutModal.classList.add('hidden-modal');
    });

    // 【修复新增】：动态注入并绑定重置视角按钮 (去字留标，继承原有按钮统一样式)
    let btnReset = document.getElementById('btn-reset');
    if (!btnReset && document.getElementById('btn-settings')) {
        const btnSettings = document.getElementById('btn-settings');
        btnReset = document.createElement('button');
        btnReset.id = 'btn-reset';
        btnReset.innerHTML = '🔄'; 
        btnReset.title = '重置视角 / Reset View';
        btnReset.className = btnSettings.className; // 【样式统一】继承已有按钮的 class 样式
        btnSettings.parentNode.insertBefore(btnReset, btnSettings);
    }
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (initialCameraState.pos.length() > 0) {
                // 禁用控制器本身的阻尼，防止与我们的动画冲突（可选，但推荐）
                const tempDamping = controls.enableDamping;
                controls.enableDamping = false;
                
                // 触发平滑移动，时长设为 2000 毫秒（2.0秒）
                resetCameraSmoothly(initialCameraState.pos, initialCameraState.target, 2000);
                
                // 动画大概结束后恢复阻尼设置
                setTimeout(() => {
                    controls.enableDamping = tempDamping;
                }, 1300); 
            }
        });
    }

    // =========================================================================
    // 【全新功能】：无侵入式动态注入建筑统计图表功能与UI面板
    let btnChart = document.getElementById('btn-chart');
    if (!btnChart && document.getElementById('btn-settings')) {
        const btnSettings = document.getElementById('btn-settings');
        btnChart = document.createElement('button');
        btnChart.id = 'btn-chart';
        btnChart.innerHTML = '📊'; 
        btnChart.title = '建筑数据统计 / Building Stats';
        btnChart.className = btnSettings.className; // 继承已有按钮的 class 样式，保证完全一致
        btnSettings.parentNode.insertBefore(btnChart, btnSettings);
    }

    let chartModal = document.getElementById('chart-modal');
    if (!chartModal) {
        chartModal = document.createElement('div');
        chartModal.id = 'chart-modal';
        // 【修改点】：增加宽度和响应式支持
        chartModal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(20,30,48,0.95); padding:20px; border-radius:10px; border:1px solid #00f3ff; z-index:9999; color:#fff; width: 85vw; max-width: 900px; display:none; flex-direction:column; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); font-family: sans-serif; transition: opacity 0.3s;';

        chartModal.innerHTML = `
            <h3 data-i18n="chartTitle" style="margin:0 0 15px 0; border-bottom:1px solid #445566; padding-bottom:10px; font-size: 16px; text-align: center;">📊 城市建筑数据多维统计</h3>
            
            <div style="display: flex; flex-direction: row; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
                
                <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column;">
                    <h4 data-i18n="chartTitleHeight" style="text-align:center; margin:5px 0 10px 0; font-size:14px; color:#00f3ff;">📈 高度统计</h4>
                    <div id="chart-render-height" style="height: 160px; display: flex; align-items: flex-end; justify-content: space-around; border-bottom: 1px solid #667788; border-left: 1px solid #667788; padding: 10px 5px 0 5px;"></div>
                    <div id="chart-labels-height" style="display: flex; justify-content: space-around; margin-top: 8px; font-size: 11px; color: #aabbcc;"></div>
                </div>

                <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column;">
                    <h4 data-i18n="chartTitleArea" style="text-align:center; margin:5px 0 10px 0; font-size:14px; color:#ffb800;">📉 面积统计</h4>
                    <div id="chart-render-area" style="height: 160px; display: flex; align-items: flex-end; justify-content: space-around; border-bottom: 1px solid #667788; border-left: 1px solid #667788; padding: 10px 5px 0 5px;"></div>
                    <div id="chart-labels-area" style="display: flex; justify-content: space-around; margin-top: 8px; font-size: 11px; color: #aabbcc;"></div>
                </div>

                <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column;">
                    <h4 data-i18n="chartTitleVolume" style="text-align:center; margin:5px 0 10px 0; font-size:14px; color:#00ff9d;">🧊 体量统计</h4>
                    <div id="chart-render-volume" style="height: 160px; display: flex; align-items: flex-end; justify-content: space-around; border-bottom: 1px solid #667788; border-left: 1px solid #667788; padding: 10px 5px 0 5px;"></div>
                    <div id="chart-labels-volume" style="display: flex; justify-content: space-around; margin-top: 8px; font-size: 11px; color: #aabbcc;"></div>
                </div>

            </div>

            <div style="margin-top:25px; text-align:center;">
                <button id="btn-close-chart" data-i18n="chartClose" style="padding: 6px 25px; cursor: pointer; background: #28385e; color: white; border: 1px solid #00f3ff; border-radius: 4px; font-size: 14px;">关闭 (Close)</button>
            </div>
        `;
        document.body.appendChild(chartModal);

        document.getElementById('btn-close-chart').addEventListener('click', () => {
            chartModal.style.display = 'none';
        });
    }

    if (btnChart) {
        btnChart.addEventListener('click', () => {
            if (cityGroup && cityGroup.children.length > 0) {
                // 定义高度、面积、体量的区间和标签 (使用通用单位和k代表千，兼容中英文)
                let hCounts = [0, 0, 0, 0, 0];
                let hLabels = ['<20m', '20-50m', '50-100m', '100-200m', '>200m'];

                let aCounts = [0, 0, 0, 0, 0];
                let aLabels = ['<500m²', '500-1k', '1k-2k', '2k-5k', '>5km²'];

                let vCounts = [0, 0, 0, 0, 0];
                let vLabels = ['<10km³', '10-50k', '50-100k', '100-200k', '>200km³'];

                // 一次遍历，同时统计三个指标
                cityGroup.children.forEach(mesh => {
                    let h = mesh.userData.height || 0;
                    if (h < 20) hCounts[0]++; else if (h < 50) hCounts[1]++; else if (h < 100) hCounts[2]++; else if (h < 200) hCounts[3]++; else hCounts[4]++;

                    let a = mesh.userData.area || 0;
                    if (a < 500) aCounts[0]++; else if (a < 1000) aCounts[1]++; else if (a < 2000) aCounts[2]++; else if (a < 5000) aCounts[3]++; else aCounts[4]++;

                    let v = mesh.userData.volume || 0;
                    // 以 10k (1万) m³ 为基准区间
                    if (v < 10000) vCounts[0]++; else if (v < 50000) vCounts[1]++; else if (v < 100000) vCounts[2]++; else if (v < 200000) vCounts[3]++; else vCounts[4]++;
                });

                // 提取通用的渲染函数
                function renderBarChart(counts, labels, renderId, labelsId, themeColor) {
                    let maxCount = Math.max(...counts, 1);
                    let renderArea = document.getElementById(renderId);
                    let labelsArea = document.getElementById(labelsId);
                    renderArea.innerHTML = '';
                    labelsArea.innerHTML = '';

                    counts.forEach((c, i) => {
                        let pct = (c / maxCount) * 100;
                        pct = Math.max(pct, 2); // 至少保留2%高度避免看不到

                        let col = document.createElement('div');
                        col.style.cssText = 'flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; margin: 0 3px;';

                        let val = document.createElement('span');
                        val.innerText = c;
                        val.style.cssText = `font-size: 11px; margin-bottom: 5px; color: ${themeColor}; font-weight: bold;`;

                        let bar = document.createElement('div');
                        // 使用对应的颜色，透明度调高更具质感
                        bar.style.cssText = `width: 100%; height: ${pct}%; background: ${themeColor}; border-radius: 2px 2px 0 0; opacity: 0.85; transition: height 0.6s ease;`;

                        col.appendChild(val);
                        col.appendChild(bar);
                        renderArea.appendChild(col);

                        let lbl = document.createElement('span');
                        lbl.innerText = labels[i];
                        lbl.style.cssText = 'flex: 1; text-align: center; white-space: nowrap; transform: scale(0.85);';
                        labelsArea.appendChild(lbl);
                    });
                }

                // 渲染三个图表，赋予不同的主题色作区分
                renderBarChart(hCounts, hLabels, 'chart-render-height', 'chart-labels-height', '#00f3ff'); // 蓝青色
                renderBarChart(aCounts, aLabels, 'chart-render-area', 'chart-labels-area', '#ffb800');    // 暖黄色
                renderBarChart(vCounts, vLabels, 'chart-render-volume', 'chart-labels-volume', '#00ff9d'); // 荧光绿

                // 显示模态框
                chartModal.style.display = 'flex';
                // 强制应用当前的语言翻译以防切语言后第一次打开漏翻
                switchLanguage(currentLang);
            } else {
                alert(currentLang === 'zh' ? i18nDict.zh.chartNoData : i18nDict.en.chartNoData);
            }
        });
    }
    // =========================================================================

    // 特效开关与新功能
    document.getElementById('toggle-ripple').addEventListener('change', (e) => {
        uniforms.uRippleEnabled.value = e.target.checked;
    });
    document.getElementById('toggle-fog').addEventListener('change', (e) => {
        scene.fog.density = e.target.checked ? originalFogDensity : 0;
    });
    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        if (gridHelper) gridHelper.visible = e.target.checked;
    });
    
    // 【新功能：自动漫游视角】
    document.getElementById('toggle-autorotate').addEventListener('change', (e) => {
        controls.autoRotate = e.target.checked;
        controls.autoRotateSpeed = 1.5;
    });

    // 【新功能：语言切换】
    document.getElementById('lang-select').addEventListener('change', (e) => {
        switchLanguage(e.target.value);
    });

    // 【新功能：全屏切换】
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // 【新功能：超高清相机截图 (自动提高DPI导出)】
    document.getElementById('btn-camera').addEventListener('click', () => {
        // 保存原有的像素比
        const originalRatio = renderer.getPixelRatio();
        // 设置超高像素比模拟 300 DPI (根据情况可设为 3.0 或 4.0)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio * 3, 4.0)); 
        
        // 强制渲染当前帧
        renderer.render(scene, camera);
        
        // 提取图像数据
        const dataURL = renderer.domElement.toDataURL('image/png', 1.0);
        
        // 恢复原有像素比避免后续卡顿
        renderer.setPixelRatio(originalRatio); 
        
        // 触发下载
        const link = document.createElement('a');
        const cityName = document.getElementById('city-select').value;
        link.download = `3D_Urban_${cityName}_${new Date().getTime()}.png`;
        link.href = dataURL;
        link.click();
    });
}

// 【新增】：提取出独立的底图应用逻辑，方便随时调用同步状态
function applyBasemap(val) {
    if (!baseMapPlane) return;

    if (val === 'none') {
        baseMapPlane.visible = false;
    } else if (val === 'white') {
        baseMapPlane.visible = true;
        baseMapPlane.material.map = null;
        baseMapPlane.material.color.setHex(0xffffff);
        baseMapPlane.material.needsUpdate = true;
    } else if (val === 'black') {
        baseMapPlane.visible = true;
        baseMapPlane.material.map = null;
        baseMapPlane.material.color.setHex(0x000000);
        baseMapPlane.material.needsUpdate = true;
    } else if (val === 'satellite') {
        baseMapPlane.visible = true;
        baseMapPlane.material.color.setHex(0xffffff); // 防止底色发黑

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/5/12', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            // 增加贴图平铺密度，让遥感地图更细腻
            texture.repeat.set(20, 20);
            baseMapPlane.material.map = texture;
            baseMapPlane.material.needsUpdate = true;
        }, undefined, (err) => {
            console.error("遥感底图加载失败，可能是跨域或网络问题:", err);
        });
    }
}

// 在 bindUIEvents 中重新绑定事件：
// 请确保你的 HTML 中包含： <select id="basemap-select">...</select>
const basemapSelect = document.getElementById('basemap-select');
if (basemapSelect) {
    basemapSelect.addEventListener('change', (e) => {
        applyBasemap(e.target.value);
    });
}

function onMouseMove(event) {
    // 【修复2】：判断鼠标是否在 UI 弹窗等非画布元素上，如果是则直接拦截，清除高亮并退出
    if (event.target.tagName !== 'CANVAS') {
        if (hoveredMesh) {
            hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor);
            hoveredMesh = null;
            infoPanel.classList.add('hidden');
        }
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cityGroup.children);

    if (intersects.length > 0) {
        const object = intersects[0].object;

        if (hoveredMesh !== object) {
            if (hoveredMesh) hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor);
            
            hoveredMesh = object;
            hoveredMesh.material.color.setHex(0x00f3ff); 
            
            bldIdText.innerText = `ID: ${hoveredMesh.userData.id}`;
            bldHeightText.innerText = hoveredMesh.userData.height.toFixed(2) + ' m';
            
            const pt = intersects[0].point;
            if (globalLocalOrigin) {
                const localMeshX = pt.x - globalCityOffset.x;
                const localMeshZ = pt.z - globalCityOffset.z;
                
                const webMercX = localMeshX + globalLocalOrigin[0];
                const webMercY = globalLocalOrigin[1] - localMeshZ; 
                
                const [lon, lat] = inverseWebMercator(webMercX, webMercY);
                bldCoordsText.innerText = `${lon.toFixed(4)}°, ${lat.toFixed(4)}°`;
            } else {
                bldCoordsText.innerText = `Calculating...`;
            }
            
            infoPanel.classList.remove('hidden');
        }
    } else {
        if (hoveredMesh) {
            hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor);
            hoveredMesh = null;
            infoPanel.classList.add('hidden');
        }
    }
}

function onPointerDown(event) {
    // 记录按下的初始位置，用于判断是“点击”还是“拖拽滑动”
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
}

function onPointerUp(event) {
    // 1. 防误触：如果 X 或 Y 移动距离超过 5 像素，说明用户在拖拽旋转地图，不是点击，直接返回
    if (Math.abs(event.clientX - pointerDownX) > 5 || Math.abs(event.clientY - pointerDownY) > 5) {
        return;
    }

    // 2. 计算标准化设备坐标 (NDC)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 3. 发射射线
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cityGroup.children);

    if (intersects.length > 0) {
        const object = intersects[0].object;

        // 恢复之前高亮建筑的颜色
        if (hoveredMesh && hoveredMesh !== object) {
            hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor || 0x28385e);
        }

        // ==========================================
        // 【修改点】：与 onMouseMove 样式保持完全一致
        // ==========================================
        hoveredMesh = object;
        hoveredMesh.material.color.setHex(0x00f3ff); // 1. 颜色改为与悬停一致的亮蓝色

        // 2. 补全 ID 前缀
        if (bldIdText) bldIdText.innerText = `ID: ${hoveredMesh.userData.id}`;

        // 3. 高度保留 2 位小数
        if (bldHeightText) bldHeightText.innerText = (hoveredMesh.userData.height || 0).toFixed(2) + ' m';

        // 4. 反算真实经纬度（统一保留 4 位小数并加上度数符号）
        if (globalLocalOrigin && bldCoordsText) {
            const pt = intersects[0].point;

            const localMeshX = pt.x - globalCityOffset.x;
            const localMeshZ = pt.z - globalCityOffset.z;

            const webMercX = localMeshX + globalLocalOrigin[0];
            const webMercY = globalLocalOrigin[1] - localMeshZ;

            const [lon, lat] = inverseWebMercator(webMercX, webMercY);
            bldCoordsText.innerText = `${lon.toFixed(4)}°, ${lat.toFixed(4)}°`;
        } else if (bldCoordsText) {
            bldCoordsText.innerText = `Calculating...`;
        }

        // 移除隐藏样式，让面板在手机上弹出来
        infoPanel.classList.remove('hidden');

    } else {
        // 点击了没有建筑的空白地带 -> 恢复颜色并隐藏面板
        if (hoveredMesh) {
            hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor || 0x28385e);
            hoveredMesh = null;
        }
        if (infoPanel) infoPanel.classList.add('hidden');
    }
}

// 【修改】：执行点击后的射线检测与 UI 更新（完全对齐电脑端悬停样式）
function triggerRaycastClick() {
    raycaster.setFromCamera(mouse, camera);

    // 只检测建筑组 (cityGroup) 内的模型
    const intersects = raycaster.intersectObjects(cityGroup.children, false);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        const point = intersects[0].point; // 交点真实三维坐标

        // --- 1. 高亮选中的建筑 ---
        if (hoveredMesh !== object) {
            if (hoveredMesh) {
                // 恢复上一个建筑的默认颜色
                hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor || 0x28385e);
            }
            hoveredMesh = object;
            // 【修改点1】：颜色统一改为亮蓝色，和悬停保持一致
            hoveredMesh.material.color.setHex(0x00f3ff);
        }

        // --- 2. 更新属性面板文字 ---
        if (bldIdText) bldIdText.innerText = `ID: ${object.userData.id || "未知"}`; // 统一加上 "ID: " 前缀
        // 【修改点2】：高度保留2位小数，和悬停保持一致
        if (bldHeightText) bldHeightText.innerText = (object.userData.height || 0).toFixed(2) + ' m';

        // --- 3. 反算真实经纬度 ---
        if (globalLocalOrigin && bldCoordsText) {
            // 将三维交点坐标还原为相对原点的平面坐标
            const localX = point.x - globalCityOffset.x;
            const localZ = point.z - globalCityOffset.z;

            // Web 墨卡托投影反算 (注意 Three.js 中 Z 轴向前是负的)
            const mx = localX + globalLocalOrigin[0];
            const my = -localZ + globalLocalOrigin[1];

            const [lon, lat] = inverseWebMercator(mx, my);
            // 【修改点3】：经纬度保留4位小数，并加上 ° 符号，和悬停保持一致
            bldCoordsText.innerText = `${lon.toFixed(4)}°, ${lat.toFixed(4)}°`;
        } else if (bldCoordsText) {
            bldCoordsText.innerText = `Calculating...`;
        }

        // --- 4. 强制显示面板 ---
        if (infoPanel) {
            infoPanel.style.display = '';
            infoPanel.classList.remove('hidden');
        }

    } else {
        // 如果点击到了空白处（底图/天空）
        if (hoveredMesh) {
            hoveredMesh.material.color.setHex(hoveredMesh.userData.baseColor || 0x28385e);
            hoveredMesh = null;
        }
        // 隐藏面板
        if (infoPanel) {
            infoPanel.classList.add('hidden');
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    uniforms.uTime.value = clock.getElapsedTime();
    
    if (controls && camera) {
        const compassPointer = document.getElementById('compass-pointer');
        if (compassPointer) {
            const angle = controls.getAzimuthalAngle() * (180 / Math.PI);
            compassPointer.style.transform = `rotate(${angle}deg)`;
        }

        const scaleBar = document.getElementById('scale-bar');
        const scaleLabel = document.getElementById('scale-label');
        if (scaleBar && scaleLabel) {
            const distance = camera.position.distanceTo(controls.target);
            const fov = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(fov / 2) * distance;
            const visibleWidth = visibleHeight * camera.aspect;
            const metersPerPixel = visibleWidth / window.innerWidth;
            
            const baseMeters = metersPerPixel * 100;
            const power = Math.pow(10, Math.floor(Math.log10(baseMeters)));
            let fraction = baseMeters / power;
            let niceFraction = fraction < 2 ? 1 : fraction < 5 ? 2 : 5;
            let niceMeters = niceFraction * power;
            
            const actualWidthPx = niceMeters / metersPerPixel;
            scaleBar.style.width = actualWidthPx + 'px';
            scaleLabel.innerText = niceMeters >= 1000 ? (niceMeters/1000).toFixed(2) + ' km' : niceMeters + ' m';
        }
    }

    controls.update(); // 这行原本就有，现在开启 autoRotate 后它会自动旋转场景
    renderer.render(scene, camera);
}