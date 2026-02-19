// Dashboard Module

class Dashboard {
    constructor() {
        this.data = null;
        this.init();
    }

    init() {
        console.log('Dashboard module loaded');
        // Expose globally for modeSelection to access
        window.dashboard = this;
        // Setup event listeners (only once)
        this.setupEventListeners();
        // Setup image viewer
        this.setupImageViewer();
    }

    setupEventListeners() {
        // Individual object cleanup buttons (using event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cleanup-object-btn')) {
                const btn = e.target.closest('.cleanup-object-btn');
                const objectName = btn.dataset.objectName;
                this.handleCleanupObject(objectName);
            }
        });

        // Object row click to view details (using event delegation)
        document.addEventListener('click', (e) => {
            const objectCell = e.target.closest('.object-cell');
            if (objectCell) {
                const row = objectCell.closest('.object-row');
                if (row) {
                    const objectId = row.dataset.objectId;
                    this.showObjectDetail(objectId);
                }
            }
        });

        // Catalog card click to view catalog details (using event delegation)
        document.addEventListener('click', (e) => {
            const catalogCard = e.target.closest('.catalog-card');
            if (catalogCard) {
                const catalog = catalogCard.dataset.catalog;
                this.showCatalogDetail(catalog);
            }
        });
    }

    displayResults(analysisResult) {
        this.data = analysisResult;
        this.render();

        // Show dashboard button in header
        const dashboardBtn = document.getElementById('dashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.style.display = 'block';
        }
    }

    render() {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent || !this.data) return;

        const { summary, catalogBreakdown, objects, emptyDirectories, dateRange } = this.data;

        dashboardContent.innerHTML = `
            <div class="dashboard" style="display: flex; gap: 2rem; position: relative;">
                <!-- Left Sidebar Navigation -->
                <aside class="dashboard-nav" style="width: 220px; position: sticky; top: 5rem; align-self: flex-start; max-height: calc(100vh - 8rem); overflow-y: auto;">
                    <!-- Actions Section -->
                    <h3 style="font-size: 1rem; margin-bottom: 1rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Actions</h3>
                    <nav style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <button id="dashboardImportBtn" class="action-btn" style="padding: 0.75rem 1rem; background: var(--primary-color); border: none; border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; text-align: left;">
                            <span>📥</span> Import from SeeStar
                        </button>
                        <button id="dashboardLocalBtn" class="action-btn" style="padding: 0.75rem 1rem; background: var(--secondary-color); border: none; border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; text-align: left;">
                            <span>📁</span> Use Local Copy
                        </button>
                        <button id="dashboardMergeBtn" class="action-btn" style="padding: 0.75rem 1rem; background: var(--accent-color); border: none; border-radius: 8px; color: white; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; text-align: left;">
                            <span>🔀</span> Merge Library
                        </button>
                    </nav>
                    
                    <!-- Separator -->
                    <hr style="border: none; border-top: 2px solid var(--border-color); margin: 1.5rem 0;">
                    
                    <!-- Navigation Section -->
                    <h3 style="font-size: 1rem; margin-bottom: 1rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Navigation</h3>
                    <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <a href="#dashboard-top" class="nav-link" id="dashboardTopLink" style="padding: 0.75rem 1rem; background: var(--primary-color); border-radius: 8px; text-decoration: none; color: white; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; font-weight: 600;">
                            <span>📊</span> Dashboard
                        </a>
                        <a href="#summary" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📈</span> Summary
                        </a>
                        <a href="#file-types" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📄</span> File Types
                        </a>
                        <a href="#catalogs" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📚</span> Catalogs
                        </a>
                        ${emptyDirectories && emptyDirectories.length > 0 ? `
                        <a href="#empty-dirs" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>⚠️</span> Empty Dirs
                        </a>
                        ` : ''}
                        ${this.hasSubFrameCleanup(objects) ? `
                        <a href="#cleanup" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>🧹</span> Cleanup
                        </a>
                        ` : ''}
                        <a href="#objects" class="nav-link" style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;">
                            <span>🎯</span> Objects
                        </a>
                    </nav>
                </aside>

                <!-- Main Content -->
                <div class="dashboard-main" style="flex: 1; min-width: 0;">
                    <!-- Anchor for top navigation -->
                    <div id="dashboard-top" style="scroll-margin-top: 80px;"></div>

                    <!-- Header -->
                    <div class="dashboard-header" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">📊 Collection Dashboard</h2>
                            <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                ${this.data.path}
                            </p>
                        </div>
                        ${dateRange.oldest && dateRange.newest ? this.renderDateRangeInline(dateRange) : ''}
                    </div>

                    <!-- Summary Cards -->
                    <section id="summary" style="scroll-margin-top: 100px;">
                        <div class="summary-cards" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-bottom: 2rem;">
                            ${this.renderSummaryCard('🎯', 'Total Objects', summary.totalObjects, 'primary')}
                            ${this.renderSummaryCard('📦', 'With Sub-Frames', summary.withSubFrames, 'secondary')}
                            ${this.renderSummaryCard('📁', 'Without Sub-Frames', summary.withoutSubFrames, 'accent')}
                            ${this.renderSummaryCard('💾', 'Total Size', summary.totalSizeFormatted, 'success')}
                            ${this.renderSummaryCard('📄', 'Total Files', summary.totalFiles, 'info')}
                            ${summary.emptyDirectories > 0 ? this.renderSummaryCard('⚠️', 'Empty Folders', summary.emptyDirectories, 'warning') : ''}
                        </div>
                    </section>

                    <!-- File Type Breakdown -->
                    <section id="file-types" style="scroll-margin-top: 100px;">
                        <div class="file-breakdown" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                            <h3 style="margin-bottom: 1rem;">📊 File Types</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                                ${this.renderFileStat('.FIT Files', summary.fitFiles)}
                                ${this.renderFileStat('.JPG Files', summary.jpgFiles)}
                                ${summary.mp4Files > 0 ? this.renderFileStat('🎥 Videos (.MP4)', summary.mp4Files) : ''}
                                ${this.renderFileStat('Thumbnails', summary.thumbnails)}
                            </div>
                        </div>
                    </section>

                    <!-- Catalog Breakdown -->
                    <section id="catalogs" style="scroll-margin-top: 100px;">
                        ${this.renderCatalogBreakdown(catalogBreakdown)}
                    </section>

                    <!-- Empty Directories Warning -->
                    ${emptyDirectories && emptyDirectories.length > 0 ? `<section id="empty-dirs" style="scroll-margin-top: 100px;">${this.renderEmptyDirectories(emptyDirectories)}</section>` : ''}

                    <!-- Sub-Frame Cleanup Section -->
                    <section id="cleanup" style="scroll-margin-top: 100px;">
                        ${this.renderSubFrameCleanup(objects)}
                    </section>

                    <!-- Objects List -->
                    <section id="objects" style="scroll-margin-top: 100px;">
                        ${this.renderObjectsList(objects)}
                    </section>
                </div>
            </div>
        `;

        // Add event listeners
        this.attachEventListeners();
    }

    renderSummaryCard(icon, label, value, colorClass) {
        const colors = {
            primary: 'var(--primary-color)',
            secondary: 'var(--secondary-color)',
            accent: 'var(--accent-color)',
            success: 'var(--success-color)',
            warning: 'var(--warning-color)',
            info: 'var(--primary-color)'
        };

        return `
            <div class="summary-card" style="background: var(--bg-card); border-radius: 12px; padding: 1.5rem;
                                             border: 2px solid var(--border-color); transition: var(--transition);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">${icon}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${label}</div>
                <div style="font-size: 1.75rem; font-weight: 600; color: ${colors[colorClass]};">${value}</div>
            </div>
        `;
    }

    renderFileStat(label, count) {
        return `
            <div style="text-align: center; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color);">${count}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">${label}</div>
            </div>
        `;
    }

    renderCatalogBreakdown(catalogBreakdown) {
        const catalogs = Object.entries(catalogBreakdown).sort((a, b) => b[1] - a[1]);

        const catalogIcons = {
            'Messier': '🌟',
            'NGC': '🌌',
            'IC': '⭐',
            'Sharpless': '☁️',
            'Caldwell': '✨',
            'Named': '📍'
        };

        return `
            <div class="catalog-breakdown" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">📚 Catalog Breakdown</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    ${catalogs.map(([catalog, count]) => `
                        <div class="catalog-card" data-catalog="${catalog}"
                             style="display: flex; align-items: center; gap: 1rem; padding: 1rem;
                                    background: var(--bg-tertiary); border-radius: 8px; cursor: pointer;
                                    transition: all 0.2s; border: 2px solid transparent;"
                             onmouseover="this.style.background='var(--bg-secondary)'; this.style.borderColor='var(--primary-color)';"
                             onmouseout="this.style.background='var(--bg-tertiary)'; this.style.borderColor='transparent';">
                            <span style="font-size: 2rem;">${catalogIcons[catalog] || '📁'}</span>
                            <div>
                                <div style="font-weight: 600; font-size: 1.25rem; color: var(--primary-color);">${count}</div>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">${catalog}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderDateRangeInline(dateRange) {
        const oldest = new Date(dateRange.oldest);
        const newest = new Date(dateRange.newest);

        return `
            <div class="date-range-inline" style="display: flex; gap: 2rem; flex-wrap: wrap; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">From:</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">${oldest.toLocaleDateString()}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">To:</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">${newest.toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }

    hasSubFrameCleanup(objects) {
        const objectsWithSubFrames = objects.filter(obj => obj.hasSubFrames);
        if (objectsWithSubFrames.length === 0) return false;

        for (const obj of objectsWithSubFrames) {
            if (obj.subFolder) {
                const nonFitFiles = obj.subFolder.files.filter(f => !f.endsWith('.fit'));
                if (nonFitFiles.length > 0) return true;
            }
        }
        return false;
    }

    renderEmptyDirectories(emptyDirectories) {
        return `
            <div class="empty-directories-warning" style="background: var(--bg-card); border: 2px solid var(--warning-color);
                                                           border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 2rem;">⚠️</span>
                        <div>
                            <h3 style="color: var(--warning-color);">Empty Directories Found</h3>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
                                ${emptyDirectories.length} empty ${emptyDirectories.length === 1 ? 'directory' : 'directories'} can be safely deleted
                            </p>
                        </div>
                    </div>
                    <button class="btn btn-warning" id="deleteEmptyDirsBtn"
                            style="background: var(--warning-color); color: white; padding: 0.75rem 1.5rem;
                                   border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                                   transition: opacity 0.2s;"
                            onmouseover="this.style.opacity='0.8'"
                            onmouseout="this.style.opacity='1'">
                        🗑️ Delete Empty Directories
                    </button>
                </div>
                <details style="cursor: pointer;">
                    <summary style="padding: 0.5rem; background: var(--bg-tertiary); border-radius: 8px;
                                    user-select: none;">Show empty directories</summary>
                    <div style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
                        ${emptyDirectories.map(dir => `
                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); font-family: monospace;
                                        font-size: 0.875rem;">${dir.name}</div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
    }

    renderSubFrameCleanup(objects) {
        const objectsWithSubFrames = objects.filter(obj => obj.hasSubFrames);

        if (objectsWithSubFrames.length === 0) {
            return ''; // No sub-frames, no cleanup needed
        }

        // Calculate potential cleanup
        let totalNonFitFiles = 0;
        const objectsWithJpg = [];

        for (const obj of objectsWithSubFrames) {
            if (obj.subFolder) {
                const nonFitFiles = obj.subFolder.files.filter(f => !f.endsWith('.fit'));
                if (nonFitFiles.length > 0) {
                    totalNonFitFiles += nonFitFiles.length;
                    objectsWithJpg.push({
                        name: obj.displayName,
                        count: nonFitFiles.length
                    });
                }
            }
        }

        if (totalNonFitFiles === 0) {
            return ''; // No files to clean up
        }

        return `
            <div class="subframe-cleanup-section" style="background: var(--bg-card); border: 2px solid var(--primary-color);
                                                          border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 2rem;">🧹</span>
                        <div>
                            <h3 style="color: var(--primary-color);">Sub-Frame Directory Cleanup</h3>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem;">
                                ${totalNonFitFiles} non-.fit ${totalNonFitFiles === 1 ? 'file' : 'files'} can be deleted from sub-frame folders (JPG and thumbnail files)
                            </p>
                        </div>
                    </div>
                    <button class="btn btn-primary" id="cleanupSubFramesBtn"
                            style="background: var(--primary-color); color: white; padding: 0.75rem 1.5rem;
                                   border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                                   transition: opacity 0.2s;"
                            onmouseover="this.style.opacity='0.8'"
                            onmouseout="this.style.opacity='1'">
                        🧹 Clean Up Sub-Frames
                    </button>
                </div>
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; margin-top: 1rem;">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                        <strong>What will be deleted:</strong> All files except .fit files in sub-frame directories (_sub folders).
                        This includes JPG previews and thumbnails which are not needed.
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text-secondary);">
                        <strong>Note:</strong> Your original .fit files will NOT be deleted. This operation is safe and reversible
                        (files can be regenerated from .fit files if needed).
                    </p>
                </div>
                <details style="cursor: pointer; margin-top: 1rem;">
                    <summary style="padding: 0.5rem; background: var(--bg-tertiary); border-radius: 8px;
                                    user-select: none;">Show affected objects (${objectsWithJpg.length})</summary>
                    <div style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
                        ${objectsWithJpg.map(obj => `
                            <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                        display: flex; justify-content: space-between;">
                                <span style="font-family: monospace; font-size: 0.875rem;">${obj.name}</span>
                                <span style="font-size: 0.875rem; color: var(--text-secondary);">${obj.count} files</span>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
    }

    renderObjectsList(objects) {
        // Split objects into two groups
        const withSubFrames = objects.filter(obj => obj.hasSubFrames);
        const withoutSubFrames = objects.filter(obj => !obj.hasSubFrames);

        return `
            <div class="objects-list" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>🎯 Objects</h3>
                    <input type="text" id="objectSearch" placeholder="Search objects..."
                           style="padding: 0.5rem 1rem; background: var(--bg-tertiary); border: 2px solid var(--border-color);
                                  border-radius: 8px; color: var(--text-primary); width: 300px;">
                </div>
                <div id="objectsContainer">
                    ${withSubFrames.length > 0 ? `
                        <div style="margin-bottom: 2rem;">
                            <h4 style="margin-bottom: 0.75rem; color: var(--success-color); display: flex; align-items: center; gap: 0.5rem;">
                                <span>✓</span> Objects with Sub-Frames (${withSubFrames.length})
                            </h4>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${this.renderObjectsTable(withSubFrames)}
                            </div>
                        </div>
                    ` : ''}
                    ${withoutSubFrames.length > 0 ? `
                        <div>
                            <h4 style="margin-bottom: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                                <span>✗</span> Objects without Sub-Frames (${withoutSubFrames.length})
                            </h4>
                            <div style="max-height: 400px; overflow-y: auto;">
                                ${this.renderObjectsTable(withoutSubFrames)}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderObjectsTable(objects) {
        if (objects.length === 0) {
            return `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No objects found</p>`;
        }

        return `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                        <th style="padding: 1rem; text-align: left;">Object</th>
                        <th style="padding: 1rem; text-align: left;">Catalog</th>
                        <th style="padding: 1rem; text-align: center;">Sub-Frames</th>
                        <th style="padding: 1rem; text-align: right;">Sub .fit</th>
                        <th style="padding: 1rem; text-align: right;">Sub Other</th>
                        <th style="padding: 1rem; text-align: right;">Integration</th>
                        <th style="padding: 1rem; text-align: right;">Total Files</th>
                        <th style="padding: 1rem; text-align: right;">Total Size</th>
                        <th style="padding: 1rem; text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${objects.map((obj, index) => this.renderObjectRow(obj, index)).join('')}
                </tbody>
            </table>
        `;
    }

    renderObjectRow(obj, index) {
        const totalFiles = obj.mainFolder.fileCount + (obj.subFolder ? obj.subFolder.fileCount : 0);
        const totalSize = obj.mainFolder.size + (obj.subFolder ? obj.subFolder.size : 0);
        const bgColor = index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)';
        const hoverBgColor = index % 2 === 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';

        // Count .fit and non-.fit files in sub-frame folder
        let subFitCount = 0;
        let subOtherCount = 0;
        if (obj.subFolder) {
            subFitCount = obj.subFolder.files.filter(f => f.endsWith('.fit')).length;
            subOtherCount = obj.subFolder.files.filter(f => !f.endsWith('.fit')).length;
        }

        const rowId = `object-row-${obj.name.replace(/\s+/g, '-')}`;

        return `
            <tr class="object-row" id="${rowId}" data-object-name="${obj.name.toLowerCase()}" data-catalog="${obj.catalog.toLowerCase()}"
                data-object-id="${obj.name}"
                style="background: ${bgColor}; border-bottom: 1px solid var(--border-color); transition: all 0.2s; cursor: pointer;"
                onmouseover="this.style.background='${hoverBgColor}'; this.style.borderLeftColor='var(--primary-color)'; this.style.borderLeftWidth='4px'; this.querySelector('.object-name').style.color='var(--primary-color)'; this.querySelector('.object-name').style.textDecoration='underline';"
                onmouseout="this.style.background='${bgColor}'; this.style.borderLeftColor='var(--border-color)'; this.style.borderLeftWidth='0px'; this.querySelector('.object-name').style.color=''; this.querySelector('.object-name').style.textDecoration='none';">
                <td style="padding: 1rem;" class="object-cell">
                    <strong class="object-name" style="transition: all 0.2s;">${obj.displayName}</strong>
                    ${obj.isMosaic ? '<span style="font-size: 0.75rem; background: var(--accent-color); color: black; padding: 0.125rem 0.5rem; border-radius: 4px; margin-left: 0.5rem;">Mosaic</span>' : ''}
                </td>
                <td style="padding: 1rem; color: var(--text-secondary);" class="object-cell">${obj.catalog}</td>
                <td style="padding: 1rem; text-align: center;" class="object-cell">
                    ${obj.hasSubFrames ? '<span style="color: var(--success-color);">✓</span>' : '<span style="color: var(--text-muted);">✗</span>'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace; color: var(--text-secondary);" class="object-cell">
                    ${obj.hasSubFrames ? subFitCount : '-'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace; color: var(--text-secondary);" class="object-cell">
                    ${obj.hasSubFrames ? subOtherCount : '-'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace; color: var(--text-secondary);" class="object-cell">
                    ${obj.totalIntegrationTime > 0 ? this.formatIntegrationTime(obj.totalIntegrationTime) : '-'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace;" class="object-cell">${totalFiles}</td>
                <td style="padding: 1rem; text-align: right; font-family: monospace;" class="object-cell">${app.formatBytes(totalSize)}</td>
                <td style="padding: 1rem; text-align: center;">
                    ${obj.hasSubFrames && subOtherCount > 0 ? `
                        <button class="cleanup-object-btn" data-object-name="${obj.name}"
                                style="background: var(--warning-color); color: white; border: none;
                                       border-radius: 6px; padding: 0.375rem 0.75rem; cursor: pointer;
                                       font-size: 0.875rem; font-weight: 600; transition: opacity 0.2s;"
                                onmouseover="event.stopPropagation(); this.style.opacity='0.8';"
                                onmouseout="event.stopPropagation(); this.style.opacity='1';"
                                title="Clean up ${subOtherCount} non-.fit file${subOtherCount === 1 ? '' : 's'}">
                            🧹 Clean
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }

    attachEventListeners() {
        // Action buttons
        const dashboardImportBtn = document.getElementById('dashboardImportBtn');
        if (dashboardImportBtn) {
            dashboardImportBtn.addEventListener('click', async () => {
                console.log('Dashboard: Launching Import Wizard');
                // Show screen first
                app.showScreen('importWizardScreen');

                // Reset and render import wizard
                if (window.importWizard) {
                    window.importWizard.currentStep = 1;
                    window.importWizard.selectedDevice = null;
                    await window.importWizard.renderStep(1);
                } else {
                    // Create new instance if it doesn't exist
                    window.importWizard = new ImportWizard();
                }
            });
            // Hover effect
            dashboardImportBtn.addEventListener('mouseenter', function () {
                this.style.opacity = '0.9';
                this.style.transform = 'translateY(-2px)';
            });
            dashboardImportBtn.addEventListener('mouseleave', function () {
                this.style.opacity = '1';
                this.style.transform = 'translateY(0)';
            });
        }

        const dashboardLocalBtn = document.getElementById('dashboardLocalBtn');
        if (dashboardLocalBtn) {
            dashboardLocalBtn.addEventListener('click', () => {
                console.log('Dashboard: Opening Local Copy Browser');
                // Trigger the local mode selection (same as clicking "Use Local Copy" on welcome screen)
                if (window.modeSelection) {
                    window.modeSelection.selectLocalMode();
                }
            });
            // Hover effect
            dashboardLocalBtn.addEventListener('mouseenter', function () {
                this.style.opacity = '0.9';
                this.style.transform = 'translateY(-2px)';
            });
            dashboardLocalBtn.addEventListener('mouseleave', function () {
                this.style.opacity = '1';
                this.style.transform = 'translateY(0)';
            });
        }

        const dashboardMergeBtn = document.getElementById('dashboardMergeBtn');
        if (dashboardMergeBtn) {
            dashboardMergeBtn.addEventListener('click', async () => {
                console.log('Dashboard: Launching Merge Wizard');
                // Show screen first
                app.showScreen('mergeWizardScreen');

                // Reset and render merge wizard
                if (window.mergeWizard) {
                    window.mergeWizard.currentStep = 1;
                    window.mergeWizard.sourcePaths = [];
                    window.mergeWizard.destinationPath = null;
                    window.mergeWizard.mergePlan = null;
                    await window.mergeWizard.renderStep(1);
                } else {
                    // Create new instance if it doesn't exist
                    window.mergeWizard = new MergeWizard();
                }
            });
            // Hover effect
            dashboardMergeBtn.addEventListener('mouseenter', function () {
                this.style.opacity = '0.9';
                this.style.transform = 'translateY(-2px)';
            });
            dashboardMergeBtn.addEventListener('mouseleave', function () {
                this.style.opacity = '1';
                this.style.transform = 'translateY(0)';
            });
        }

        // Search functionality
        const searchInput = document.getElementById('objectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterObjects(e.target.value.toLowerCase());
            });
        }

        // Delete empty directories button
        const deleteEmptyDirsBtn = document.getElementById('deleteEmptyDirsBtn');
        if (deleteEmptyDirsBtn) {
            deleteEmptyDirsBtn.addEventListener('click', () => {
                this.handleDeleteEmptyDirectories();
            });
        }

        // Cleanup sub-frames button
        const cleanupSubFramesBtn = document.getElementById('cleanupSubFramesBtn');
        if (cleanupSubFramesBtn) {
            cleanupSubFramesBtn.addEventListener('click', () => {
                this.handleCleanupSubFrames();
            });
        }

        // Navigation links - smooth scrolling with header offset
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    // Get header height and add some padding
                    const header = document.querySelector('.app-header');
                    const headerHeight = header ? header.offsetHeight : 0;
                    const offset = headerHeight + 20; // 20px extra padding

                    // Calculate position accounting for header
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;

                    // Smooth scroll to position
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    // Update active state
                    navLinks.forEach(l => {
                        l.style.background = 'var(--bg-tertiary)';
                        l.style.color = 'var(--text-primary)';
                    });
                    link.style.background = 'var(--primary-color)';
                    link.style.color = 'white';
                }
            });

            // Hover effects
            link.addEventListener('mouseenter', function () {
                if (this.style.background !== 'var(--primary-color)') {
                    this.style.background = 'var(--bg-secondary)';
                }
            });

            link.addEventListener('mouseleave', function () {
                if (this.style.background !== 'var(--primary-color)') {
                    this.style.background = 'var(--bg-tertiary)';
                }
            });
        });
    }

    filterObjects(searchTerm) {
        const rows = document.querySelectorAll('.object-row');
        rows.forEach(row => {
            const name = row.getAttribute('data-object-name');
            const catalog = row.getAttribute('data-catalog');

            if (name.includes(searchTerm) || catalog.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    formatIntegrationTime(seconds) {
        if (seconds === 0) return '0s';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    }

    // Cleanup Operations

    async handleDeleteEmptyDirectories() {
        if (!this.data || !this.data.emptyDirectories || this.data.emptyDirectories.length === 0) {
            return;
        }

        const count = this.data.emptyDirectories.length;
        const confirmMessage = `
            <div style="text-align: left;">
                <p>Are you sure you want to delete <strong>${count}</strong> empty ${count === 1 ? 'directory' : 'directories'}?</p>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                    This action cannot be undone. Empty directories will be permanently removed from your file system.
                </p>
            </div>
        `;

        app.showModal(
            '🗑️ Delete Empty Directories',
            confirmMessage,
            async () => {
                await this.deleteEmptyDirectories();
            },
            'Delete'
        );
    }

    async deleteEmptyDirectories() {
        try {
            app.showLoading('Deleting empty directories...');

            const response = await fetch('/api/cleanup/empty-directories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    directories: this.data.emptyDirectories
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`);
            }

            const result = await response.json();

            app.hideLoading();

            if (result.success || result.totalDeleted > 0) {
                const message = `
                    <div style="text-align: left;">
                        <p style="color: var(--success-color); font-weight: 600; margin-bottom: 1rem;">
                            ✓ Successfully deleted ${result.totalDeleted} empty ${result.totalDeleted === 1 ? 'directory' : 'directories'}
                        </p>
                        ${result.totalFailed > 0 ? `
                            <p style="color: var(--warning-color); margin-top: 0.5rem;">
                                ⚠️ Failed to delete ${result.totalFailed} ${result.totalFailed === 1 ? 'directory' : 'directories'}
                            </p>
                        ` : ''}
                    </div>
                `;

                app.showModal('Cleanup Complete', message, null, 'Close');

                // Refresh the dashboard
                setTimeout(() => {
                    this.refreshDashboard();
                }, 1500);
            } else {
                app.showModal('Error', `<p>Failed to delete directories: ${result.error || 'Unknown error'}</p>`, null, 'Close');
            }

        } catch (error) {
            app.hideLoading();
            console.error('Error deleting empty directories:', error);
            app.showModal('Error', `<p>An error occurred: ${error.message}</p>`, null, 'Close');
        }
    }

    async handleCleanupSubFrames() {
        if (!this.data || !this.data.objects) {
            return;
        }

        const objectsWithSubFrames = this.data.objects.filter(obj => obj.hasSubFrames);

        if (objectsWithSubFrames.length === 0) {
            return;
        }

        // Calculate total files to delete
        let totalFiles = 0;
        for (const obj of objectsWithSubFrames) {
            if (obj.subFolder) {
                const nonFitFiles = obj.subFolder.files.filter(f => !f.endsWith('.fit'));
                totalFiles += nonFitFiles.length;
            }
        }

        const confirmMessage = `
            <div style="text-align: left;">
                <p>Are you sure you want to clean up sub-frame directories?</p>
                <p style="margin-top: 1rem;">
                    This will delete approximately <strong>${totalFiles}</strong> files (JPG and thumbnail files) from <strong>${objectsWithSubFrames.length}</strong> sub-frame folders.
                </p>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                    <strong>What will be deleted:</strong> All files except .fit files in _sub directories.
                </p>
                <p style="margin-top: 0.5rem; color: var(--success-color); font-size: 0.875rem;">
                    <strong>Safe:</strong> Your .fit files will NOT be touched. This operation is safe.
                </p>
            </div>
        `;

        app.showModal(
            '🧹 Clean Up Sub-Frame Directories',
            confirmMessage,
            async () => {
                await this.cleanupSubFrames();
            },
            'Clean Up'
        );
    }

    async cleanupSubFrames() {
        try {
            app.showLoading('Cleaning up sub-frame directories...');

            const response = await fetch('/api/cleanup/subframe-directories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    objects: this.data.objects
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`);
            }

            const result = await response.json();

            app.hideLoading();

            if (result.success || result.totalFilesDeleted > 0) {
                const message = `
                    <div style="text-align: left;">
                        <p style="color: var(--success-color); font-weight: 600; margin-bottom: 1rem;">
                            ✓ Cleanup Complete!
                        </p>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin-bottom: 0.5rem;">📊 Objects cleaned: <strong>${result.cleaned.length}</strong></li>
                            <li style="margin-bottom: 0.5rem;">🗑️ Files deleted: <strong>${result.totalFilesDeleted}</strong></li>
                            <li style="margin-bottom: 0.5rem;">💾 Space freed: <strong>${app.formatBytes(result.totalSpaceFreed)}</strong></li>
                        </ul>
                        ${result.failed.length > 0 ? `
                            <p style="color: var(--warning-color); margin-top: 1rem;">
                                ⚠️ ${result.failed.length} ${result.failed.length === 1 ? 'object' : 'objects'} failed to clean
                            </p>
                        ` : ''}
                    </div>
                `;

                app.showModal('Cleanup Complete', message, null, 'Close');

                // Refresh the dashboard
                setTimeout(() => {
                    this.refreshDashboard();
                }, 2000);
            } else {
                app.showModal('Error', `<p>Failed to clean up sub-frames: ${result.error || 'Unknown error'}</p>`, null, 'Close');
            }

        } catch (error) {
            app.hideLoading();
            console.error('Error cleaning up sub-frames:', error);
            app.showModal('Error', `<p>An error occurred: ${error.message}</p>`, null, 'Close');
        }
    }

    async handleCleanupObject(objectName) {
        if (!this.data || !this.data.objects) {
            return;
        }

        // Find the specific object
        const object = this.data.objects.find(obj => obj.name === objectName);

        if (!object || !object.hasSubFrames || !object.subFolder) {
            return;
        }

        // Count non-.fit files
        const nonFitFiles = object.subFolder.files.filter(f => !f.endsWith('.fit'));

        if (nonFitFiles.length === 0) {
            app.showModal('Nothing to Clean', '<p>This object has no non-.fit files to clean up.</p>', null, 'Close');
            return;
        }

        const confirmMessage = `
            <div style="text-align: left;">
                <p>Clean up sub-frame directory for <strong>${object.displayName}</strong>?</p>
                <p style="margin-top: 1rem;">
                    This will delete <strong>${nonFitFiles.length}</strong> file${nonFitFiles.length === 1 ? '' : 's'} (JPG and thumbnail files).
                </p>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                    <strong>What will be deleted:</strong> All files except .fit files in the _sub directory.
                </p>
                <p style="margin-top: 0.5rem; color: var(--success-color); font-size: 0.875rem;">
                    <strong>Safe:</strong> Your .fit files will NOT be touched.
                </p>
            </div>
        `;

        app.showModal(
            `🧹 Clean Up ${object.displayName}`,
            confirmMessage,
            async () => {
                await this.cleanupSingleObject(object);
            },
            'Clean Up'
        );
    }

    async cleanupSingleObject(object) {
        try {
            app.showLoading(`Cleaning up ${object.displayName}...`);

            const response = await fetch('/api/cleanup/subframe-directories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    objects: [object]  // Send only this single object
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`);
            }

            const result = await response.json();

            app.hideLoading();

            if (result.success || result.totalFilesDeleted > 0) {
                // Remove the cleanup button immediately so it doesn't linger
                const cleanupBtn = document.querySelector(`.cleanup-object-btn[data-object-name="${object.name}"]`);
                if (cleanupBtn) {
                    cleanupBtn.remove();
                }

                const cleanedObj = result.cleaned[0];
                const message = `
                    <div style="text-align: left;">
                        <p style="color: var(--success-color); font-weight: 600; margin-bottom: 1rem;">
                            ✓ Cleanup Complete!
                        </p>
                        <p style="margin-bottom: 0.5rem;">Object: <strong>${object.displayName}</strong></p>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin-bottom: 0.5rem;">🗑️ Files deleted: <strong>${cleanedObj ? cleanedObj.filesDeleted : result.totalFilesDeleted}</strong></li>
                            <li style="margin-bottom: 0.5rem;">💾 Space freed: <strong>${app.formatBytes(result.totalSpaceFreed)}</strong></li>
                        </ul>
                    </div>
                `;

                app.showModal('Cleanup Complete', message, null, 'Done');

                // Refresh the dashboard and re-render object detail if still on that screen
                setTimeout(async () => {
                    await this.refreshDashboard();
                    if (app.currentScreen === 'objectDetail') {
                        this.showObjectDetail(object.name);
                    }
                }, 2000);
            } else {
                app.showModal('Error', `<p>Failed to clean up: ${result.error || 'Unknown error'}</p>`, null, 'Close');
            }

        } catch (error) {
            app.hideLoading();
            console.error('Error cleaning up object:', error);
            app.showModal('Error', `<p>An error occurred: ${error.message}</p>`, null, 'Close');
        }
    }

    async refreshDashboard() {
        try {
            app.showLoading('Refreshing dashboard...');

            const response = await fetch(`/api/analyze?path=${encodeURIComponent(this.data.path)}`);
            const result = await response.json();

            app.hideLoading();

            if (result.success) {
                this.displayResults(result);
            }
        } catch (error) {
            app.hideLoading();
            console.error('Error refreshing dashboard:', error);
        }
    }

    // Catalog Detail View

    showCatalogDetail(catalogName) {
        if (!this.data || !this.data.objects) {
            return;
        }

        // Filter objects by catalog
        const filteredObjects = this.data.objects.filter(obj => obj.catalog === catalogName);

        if (filteredObjects.length === 0) {
            return;
        }

        this.renderCatalogDetail(catalogName, filteredObjects);
    }

    renderCatalogDetail(catalogName, filteredObjects) {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) return;

        const catalogIcons = {
            'Messier': '🌟',
            'NGC': '🌌',
            'IC': '⭐',
            'Sharpless': '☁️',
            'Caldwell': '✨',
            'Named': '📍'
        };

        // Calculate summary statistics for filtered objects
        const totalObjects = filteredObjects.length;
        const withSubFrames = filteredObjects.filter(obj => obj.hasSubFrames).length;
        const withoutSubFrames = filteredObjects.filter(obj => !obj.hasSubFrames).length;
        const totalFiles = filteredObjects.reduce((sum, obj) => {
            return sum + obj.mainFolder.fileCount + (obj.subFolder ? obj.subFolder.fileCount : 0);
        }, 0);
        const totalSize = filteredObjects.reduce((sum, obj) => {
            return sum + obj.mainFolder.size + (obj.subFolder ? obj.subFolder.size : 0);
        }, 0);
        const totalIntegration = filteredObjects.reduce((sum, obj) => sum + obj.totalIntegrationTime, 0);

        // Get date range
        let oldestDate = null;
        let newestDate = null;
        filteredObjects.forEach(obj => {
            const sessions = this.parseImagingSessions(obj);
            sessions.forEach(session => {
                if (!oldestDate || session.datetime < oldestDate) {
                    oldestDate = session.datetime;
                }
                if (!newestDate || session.datetime > newestDate) {
                    newestDate = session.datetime;
                }
            });
        });

        dashboardContent.innerHTML = `
            <div class="catalog-detail" style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
                <!-- Header with Back Button -->
                <div style="margin-bottom: 2rem;">
                    <button id="backToMainDashboardBtn" class="btn" style="background: var(--bg-tertiary); color: var(--text-primary);
                                   padding: 0.75rem 1.5rem; border: 2px solid var(--border-color); border-radius: 8px;
                                   cursor: pointer; font-weight: 600; transition: all 0.2s; display: inline-flex;
                                   align-items: center; gap: 0.5rem;"
                                   onmouseover="this.style.background='var(--bg-secondary)'"
                                   onmouseout="this.style.background='var(--bg-tertiary)'">
                        ← Back to All Catalogs
                    </button>
                </div>

                <!-- Catalog Header -->
                <div style="background: var(--bg-card); border-radius: 16px; padding: 2rem; margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1rem;">
                        <span style="font-size: 3rem;">${catalogIcons[catalogName] || '📁'}</span>
                        <div>
                            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${catalogName} Catalog</h1>
                            <p style="color: var(--text-secondary); font-size: 1.125rem;">
                                ${totalObjects} ${totalObjects === 1 ? 'object' : 'objects'} in this catalog
                            </p>
                        </div>
                    </div>
                    ${oldestDate && newestDate ? `
                        <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 0.875rem; color: var(--text-secondary);">First Capture:</span>
                                <span style="font-size: 0.875rem; font-weight: 600;">${oldestDate.toLocaleDateString()}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 0.875rem; color: var(--text-secondary);">Latest Capture:</span>
                                <span style="font-size: 0.875rem; font-weight: 600;">${newestDate.toLocaleDateString()}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    ${this.renderSummaryCard('🎯', 'Total Objects', totalObjects, 'primary')}
                    ${this.renderSummaryCard('📦', 'With Sub-Frames', withSubFrames, 'secondary')}
                    ${this.renderSummaryCard('📁', 'Without Sub-Frames', withoutSubFrames, 'accent')}
                    ${this.renderSummaryCard('💾', 'Total Size', app.formatBytes(totalSize), 'success')}
                    ${this.renderSummaryCard('📄', 'Total Files', totalFiles, 'info')}
                    ${this.renderSummaryCard('⏱️', 'Total Integration', this.formatIntegrationTime(totalIntegration), 'warning')}
                </div>

                <!-- Objects List -->
                <div class="objects-list" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>🎯 Objects in ${catalogName}</h3>
                        <input type="text" id="objectSearch" placeholder="Search objects..."
                               style="padding: 0.5rem 1rem; background: var(--bg-tertiary); border: 2px solid var(--border-color);
                                      border-radius: 8px; color: var(--text-primary); width: 300px;">
                    </div>
                    <div id="objectsContainer">
                        ${this.renderCatalogObjectsTable(filteredObjects)}
                    </div>
                </div>
            </div>
        `;

        // Add back button event listener
        const backBtn = document.getElementById('backToMainDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.render(); // Re-render the main dashboard
            });
        }

        // Add search functionality
        const searchInput = document.getElementById('objectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterObjects(e.target.value.toLowerCase());
            });
        }
    }

    renderCatalogObjectsTable(objects) {
        if (objects.length === 0) {
            return `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No objects found</p>`;
        }

        // Split objects into two groups
        const withSubFrames = objects.filter(obj => obj.hasSubFrames);
        const withoutSubFrames = objects.filter(obj => !obj.hasSubFrames);

        let html = '';

        if (withSubFrames.length > 0) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin-bottom: 0.75rem; color: var(--success-color); display: flex; align-items: center; gap: 0.5rem;">
                        <span>✓</span> Objects with Sub-Frames (${withSubFrames.length})
                    </h4>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${this.renderObjectsTable(withSubFrames)}
                    </div>
                </div>
            `;
        }

        if (withoutSubFrames.length > 0) {
            html += `
                <div>
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                        <span>✗</span> Objects without Sub-Frames (${withoutSubFrames.length})
                    </h4>
                    <div style="max-height: 400px; overflow-y: auto;">
                        ${this.renderObjectsTable(withoutSubFrames)}
                    </div>
                </div>
            `;
        }

        return html;
    }

    // Object Detail View

    showObjectDetail(objectId) {
        if (!this.data || !this.data.objects) {
            return;
        }

        const object = this.data.objects.find(obj => obj.name === objectId);
        if (!object) {
            return;
        }

        this.renderObjectDetail(object);

        // Switch to object detail screen
        app.showScreen('objectDetailScreen');

        // Scroll to top of page
        window.scrollTo(0, 0);
    }

    renderObjectDetail(obj) {
        const detailContent = document.querySelector('.object-detail-content');
        if (!detailContent) return;

        const totalFiles = obj.mainFolder.fileCount + (obj.subFolder ? obj.subFolder.fileCount : 0);
        const totalSize = obj.mainFolder.size + (obj.subFolder ? obj.subFolder.size : 0);

        detailContent.innerHTML = `
            <div class="object-detail" style="padding: 2rem; max-width: 1400px; margin: 0 auto;">
                <!-- Header with Back Button -->
                <div style="margin-bottom: 2rem;">
                    <button id="backToDashboardBtn" class="btn" style="background: var(--bg-tertiary); color: var(--text-primary);
                                   padding: 0.75rem 1.5rem; border: 2px solid var(--border-color); border-radius: 8px;
                                   cursor: pointer; font-weight: 600; transition: all 0.2s; display: inline-flex;
                                   align-items: center; gap: 0.5rem;"
                                   onmouseover="this.style.background='var(--bg-secondary)'"
                                   onmouseout="this.style.background='var(--bg-tertiary)'">
                        ← Back to Dashboard
                    </button>
                </div>

                <!-- Object Header -->
                <div style="background: var(--bg-card); border-radius: 16px; padding: 2rem; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 2rem;">
                        <div>
                            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">
                                ${obj.displayName}
                                ${obj.isMosaic ? '<span style="font-size: 1rem; background: var(--accent-color); color: black; padding: 0.25rem 0.75rem; border-radius: 6px; margin-left: 1rem;">Mosaic</span>' : ''}
                            </h1>
                            <p style="color: var(--text-secondary); font-size: 1.125rem;">
                                Catalog: <strong>${obj.catalog}</strong> ${obj.catalogNumber ? `· Number: <strong>${obj.catalogNumber}</strong>` : ''}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            ${obj.hasSubFrames && obj.subFolder && obj.subFolder.files.filter(f => !f.endsWith('.fit')).length > 0 ? `
                                <button class="cleanup-object-btn" data-object-name="${obj.name}"
                                        style="background: var(--warning-color); color: white; border: none;
                                               border-radius: 8px; padding: 0.75rem 1.5rem; cursor: pointer;
                                               font-size: 1rem; font-weight: 600; transition: opacity 0.2s;"
                                        onmouseover="this.style.opacity='0.8'"
                                        onmouseout="this.style.opacity='1'">
                                    🧹 Clean Up Sub-Frames
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    ${this.renderSummaryCard('📄', 'Total Files', totalFiles, 'primary')}
                    ${this.renderSummaryCard('💾', 'Total Size', app.formatBytes(totalSize), 'success')}
                    ${this.renderSummaryCard('⏱️', 'Integration Time', obj.totalIntegrationTime > 0 ? this.formatIntegrationTime(obj.totalIntegrationTime) : '-', 'info')}
                    ${this.renderSummaryCard('📦', 'Sub-Frames', obj.hasSubFrames ? 'Yes' : 'No', obj.hasSubFrames ? 'secondary' : 'accent')}
                    ${obj.lightFrameCount > 0 ? this.renderSummaryCard('🌟', 'Light Frames', obj.lightFrameCount, 'warning') : ''}
                </div>

                <!-- Metadata -->
                ${this.renderObjectMetadata(obj)}

                <!-- Main Folder Details -->
                <div style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">📁 Main Folder</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Location</p>
                            <p style="font-family: monospace; font-size: 0.875rem; word-break: break-all;">${obj.mainFolder.path}</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Files</p>
                            <p style="font-weight: 600;">${obj.mainFolder.fileCount}</p>
                        </div>
                        <div>
                            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Size</p>
                            <p style="font-weight: 600;">${app.formatBytes(obj.mainFolder.size)}</p>
                        </div>
                    </div>
                    ${this.renderFileList(obj.mainFolder.files, 'Main Folder Files', obj.mainFolder.path)}
                </div>

                <!-- Sub-Frames Folder Details -->
                ${obj.hasSubFrames && obj.subFolder ? `
                    <div style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem;">📦 Sub-Frames Folder</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Location</p>
                                <p style="font-family: monospace; font-size: 0.875rem; word-break: break-all;">${obj.subFolder.path}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Files</p>
                                <p style="font-weight: 600;">${obj.subFolder.fileCount}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Size</p>
                                <p style="font-weight: 600;">${app.formatBytes(obj.subFolder.size)}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">.fit Files</p>
                                <p style="font-weight: 600;">${obj.subFolder.files.filter(f => f.endsWith('.fit')).length}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.25rem;">Other Files</p>
                                <p style="font-weight: 600;">${obj.subFolder.files.filter(f => !f.endsWith('.fit')).length}</p>
                            </div>
                        </div>
                        ${this.renderFileList(obj.subFolder.files, 'Sub-Frame Files', obj.subFolder.path)}
                    </div>
                ` : ''}
            </div>
        `;

        // Add back button event listener
        const backBtn = document.getElementById('backToDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                app.showScreen('dashboardScreen');
            });
        }
    }

    parseImagingSessions(obj) {
        // Parse main folder files to extract imaging sessions
        const sessionMap = new Map(); // Use Map to group sessions by unique key
        const mainFiles = obj.mainFolder.files.filter(f => f.startsWith('Stacked_') || f.startsWith('DSO_Stacked_'));

        mainFiles.forEach(filename => {
            // Extract: Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit
            const match = filename.match(/(?:DSO_)?Stacked_(\d+)_.*?([\d.]+)s(?:_([A-Z]+))?_(\d{8}-\d{6})/);
            if (match) {
                const stackCount = parseInt(match[1]);
                const exposure = parseFloat(match[2]);
                const filter = match[3] || 'N/A';
                const dateTimeStr = match[4]; // YYYYMMDD-HHMMSS

                // Parse date
                const year = dateTimeStr.substring(0, 4);
                const month = dateTimeStr.substring(4, 6);
                const day = dateTimeStr.substring(6, 8);
                const hour = dateTimeStr.substring(9, 11);
                const minute = dateTimeStr.substring(11, 13);

                const date = new Date(`${year}-${month}-${day}T${hour}:${minute}`);
                const dateStr = date.toLocaleDateString();
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Create a unique key for this session (date + time + exposure + filter)
                const sessionKey = `${dateStr}_${timeStr}_${exposure}_${filter}`;

                if (sessionMap.has(sessionKey)) {
                    // Session already exists, add to stack count
                    const existingSession = sessionMap.get(sessionKey);
                    existingSession.stackCount += stackCount;
                    existingSession.fileCount++;
                } else {
                    // New session
                    sessionMap.set(sessionKey, {
                        stackCount,
                        exposure,
                        filter,
                        date: dateStr,
                        time: timeStr,
                        datetime: date,
                        fileCount: 1,
                        filename
                    });
                }
            }
        });

        // Convert Map to array and sort by datetime
        const sessions = Array.from(sessionMap.values());
        sessions.sort((a, b) => a.datetime - b.datetime);

        return sessions;
    }

    renderObjectMetadata(obj) {
        const sessions = this.parseImagingSessions(obj);

        // Calculate exposure breakdown for stacked images (main folder)
        const stackedExposureBreakdown = {};
        sessions.forEach(session => {
            const key = session.exposure;
            if (!stackedExposureBreakdown[key]) {
                stackedExposureBreakdown[key] = 0;
            }
            stackedExposureBreakdown[key]++;
        });

        // Calculate exposure breakdown for light frames (sub-folder)
        const lightFrameExposureBreakdown = {};
        if (obj.subFolder && obj.subFolder.files) {
            obj.subFolder.files.forEach(filename => {
                // Extract exposure from Light frames: Light_NGC 6729_30.0s_IRCUT_20250822-203353.fit
                const match = filename.match(/Light_.*?_([\d.]+)s/);
                if (match) {
                    const exposure = parseFloat(match[1]);
                    if (!lightFrameExposureBreakdown[exposure]) {
                        lightFrameExposureBreakdown[exposure] = 0;
                    }
                    lightFrameExposureBreakdown[exposure]++;
                }
            });
        }

        // Basic metadata
        const metadata = [];

        if (obj.stackingCounts && obj.stackingCounts.length > 0) {
            metadata.push({
                label: 'Stacking Counts',
                value: obj.stackingCounts.sort((a, b) => a - b).join(', '),
                help: 'Number of sub-frames stacked in each final image. Higher counts typically mean better image quality.'
            });
        }

        if (obj.exposures && obj.exposures.length > 0) {
            metadata.push({
                label: 'Exposures',
                value: obj.exposures.sort((a, b) => a - b).map(e => `${e}s`).join(', '),
                help: 'Exposure time per individual sub-frame.'
            });
        }

        if (obj.filters && obj.filters.length > 0) {
            metadata.push({
                label: 'Filters',
                value: obj.filters.join(', '),
                help: 'Optical filters used during capture (IRCUT = IR Cut filter, LP = Light Pollution filter).'
            });
        }

        if (metadata.length === 0 && sessions.length === 0) {
            return '';
        }

        return `
            <div style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">📊 Metadata</h3>

                ${metadata.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: ${sessions.length > 0 || Object.keys(stackedExposureBreakdown).length > 0 || Object.keys(lightFrameExposureBreakdown).length > 0 ? '1.5rem' : '0'};">
                        ${metadata.map(item => `
                            <div>
                                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">
                                    ${item.label}
                                    ${item.help ? `<span style="cursor: help;" title="${item.help}">ℹ️</span>` : ''}
                                </p>
                                <p style="font-weight: 600;">${item.value}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${Object.keys(stackedExposureBreakdown).length > 0 || Object.keys(lightFrameExposureBreakdown).length > 0 ? `
                    <div style="margin-bottom: ${sessions.length > 0 ? '1.5rem' : '0'};">
                        <h4 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase;">
                            Exposure Breakdown
                        </h4>

                        ${Object.keys(stackedExposureBreakdown).length > 0 ? `
                            <div style="margin-bottom: ${Object.keys(lightFrameExposureBreakdown).length > 0 ? '1rem' : '0'};">
                                <h5 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                                    Main Folder - Stacked Images
                                    <span style="cursor: help;" title="Number of stacked images at each exposure time">ℹ️</span>
                                </h5>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    ${Object.entries(stackedExposureBreakdown)
                        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                        .map(([exposure, count]) => `
                                            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                                <div>
                                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Exposure</div>
                                                    <div style="font-size: 1.25rem; font-weight: 600; color: var(--primary-color);">${exposure}s</div>
                                                </div>
                                                <div style="text-align: right;">
                                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Images</div>
                                                    <div style="font-size: 1.25rem; font-weight: 600;">${count}</div>
                                                </div>
                                            </div>
                                        `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${Object.keys(lightFrameExposureBreakdown).length > 0 ? `
                            <div>
                                <h5 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                                    Sub-Frames Folder - Light Frames
                                    <span style="cursor: help;" title="Number of individual light frames at each exposure time">ℹ️</span>
                                </h5>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    ${Object.entries(lightFrameExposureBreakdown)
                        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                        .map(([exposure, count]) => `
                                            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                                <div>
                                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Exposure</div>
                                                    <div style="font-size: 1.25rem; font-weight: 600; color: var(--success-color);">${exposure}s</div>
                                                </div>
                                                <div style="text-align: right;">
                                                    <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Frames</div>
                                                    <div style="font-size: 1.25rem; font-weight: 600;">${count}</div>
                                                </div>
                                            </div>
                                        `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${sessions.length > 0 ? `
                    <div>
                        <h4 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase;">
                            Imaging Sessions (${sessions.length})
                        </h4>
                        <div style="max-height: 300px; overflow-y: auto;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">
                                        <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem;">Date</th>
                                        <th style="padding: 0.75rem; text-align: left; font-size: 0.875rem;">Time</th>
                                        <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem;">Stacked Frames</th>
                                        <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem;">Exposure</th>
                                        <th style="padding: 0.75rem; text-align: center; font-size: 0.875rem;">Filter</th>
                                        <th style="padding: 0.75rem; text-align: right; font-size: 0.875rem;">Total Integration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sessions.map((session, idx) => {
                            const totalIntegration = session.stackCount * session.exposure;
                            const bgColor = idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)';
                            return `
                                            <tr style="background: ${bgColor}; border-bottom: 1px solid var(--border-color);">
                                                <td style="padding: 0.75rem; font-family: monospace; font-size: 0.875rem;">${session.date}</td>
                                                <td style="padding: 0.75rem; font-family: monospace; font-size: 0.875rem;">${session.time}</td>
                                                <td style="padding: 0.75rem; text-align: right; font-family: monospace; font-size: 0.875rem; font-weight: 600; color: var(--primary-color);">${session.stackCount}</td>
                                                <td style="padding: 0.75rem; text-align: right; font-family: monospace; font-size: 0.875rem;">${session.exposure}s</td>
                                                <td style="padding: 0.75rem; text-align: center; font-size: 0.875rem;">
                                                    <span style="background: var(--bg-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${session.filter}</span>
                                                </td>
                                                <td style="padding: 0.75rem; text-align: right; font-family: monospace; font-size: 0.875rem; color: var(--success-color); font-weight: 600;">
                                                    ${this.formatIntegrationTime(totalIntegration)}
                                                </td>
                                            </tr>
                                        `;
                        }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    extractCaptureDate(filename) {
        // Extract date from filename in format YYYYMMDD-HHMMSS
        // Example: "Stacked_210_NGC 6729_30.0s_IRCUT_20250822-231258.fit"
        const dateMatch = filename.match(/(\d{8})-(\d{6})/);
        if (dateMatch) {
            const dateStr = dateMatch[1]; // YYYYMMDD
            const timeStr = dateMatch[2]; // HHMMSS

            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = timeStr.substring(0, 2);
            const minute = timeStr.substring(2, 4);
            const second = timeStr.substring(4, 6);

            const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
            return date.toLocaleString();
        }
        return null;
    }

    renderFileList(files, title, folderPath) {
        if (!files || files.length === 0) {
            return '';
        }

        // Group files by type
        const fitFiles = files.filter(f => f.endsWith('.fit'));
        const jpgFiles = files.filter(f => f.endsWith('.jpg') && !f.endsWith('_thn.jpg'));
        const thnFiles = files.filter(f => f.endsWith('_thn.jpg'));
        const mp4Files = files.filter(f => f.endsWith('.mp4'));
        const otherFiles = files.filter(f =>
            !f.endsWith('.fit') &&
            !f.endsWith('.jpg') &&
            !f.endsWith('.mp4')
        );

        return `
            <details style="cursor: pointer;">
                <summary style="padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 8px;
                                user-select: none; font-weight: 600;">
                    ${title} (${files.length})
                </summary>
                <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
                    ${fitFiles.length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                .FIT Files (${fitFiles.length})
                            </h4>
                            ${fitFiles.map(file => {
            const captureDate = this.extractCaptureDate(file);
            return `
                                    <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                                font-family: monospace; font-size: 0.875rem; display: flex;
                                                justify-content: space-between; align-items: center; gap: 1rem;">
                                        <span style="flex: 1; word-break: break-all;">${file}</span>
                                        ${captureDate ? `<span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${captureDate}</span>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    ` : ''}
                    ${jpgFiles.length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                .JPG Files (${jpgFiles.length})
                            </h4>
                            ${jpgFiles.map(file => {
            const captureDate = this.extractCaptureDate(file);
            return `
                                    <div class="image-file-item" data-folder-path="${folderPath}" data-filename="${file}"
                                         style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                                font-family: monospace; font-size: 0.875rem; display: flex;
                                                justify-content: space-between; align-items: center; gap: 1rem;
                                                cursor: pointer; transition: background-color 0.2s;">
                                        <span style="flex: 1; word-break: break-all;">${file}</span>
                                        ${captureDate ? `<span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${captureDate}</span>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    ` : ''}
                    ${thnFiles.length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                Thumbnails (${thnFiles.length})
                            </h4>
                            ${thnFiles.map(file => {
            const captureDate = this.extractCaptureDate(file);
            return `
                                    <div class="image-file-item" data-folder-path="${folderPath}" data-filename="${file}"
                                         style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                                font-family: monospace; font-size: 0.875rem; display: flex;
                                                justify-content: space-between; align-items: center; gap: 1rem;
                                                cursor: pointer; transition: background-color 0.2s;">
                                        <span style="flex: 1; word-break: break-all;">${file}</span>
                                        ${captureDate ? `<span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${captureDate}</span>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    ` : ''}
                    ${mp4Files.length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                Videos (${mp4Files.length})
                            </h4>
                            ${mp4Files.map(file => {
            const captureDate = this.extractCaptureDate(file);
            return `
                                    <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                                font-family: monospace; font-size: 0.875rem; display: flex;
                                                justify-content: space-between; align-items: center; gap: 1rem;">
                                        <span style="flex: 1; word-break: break-all;">${file}</span>
                                        ${captureDate ? `<span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${captureDate}</span>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    ` : ''}
                    ${otherFiles.length > 0 ? `
                        <div style="margin-bottom: 1rem;">
                            <h4 style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                Other Files (${otherFiles.length})
                            </h4>
                            ${otherFiles.map(file => {
            const captureDate = this.extractCaptureDate(file);
            return `
                                    <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);
                                                font-family: monospace; font-size: 0.875rem; display: flex;
                                                justify-content: space-between; align-items: center; gap: 1rem;">
                                        <span style="flex: 1; word-break: break-all;">${file}</span>
                                        ${captureDate ? `<span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${captureDate}</span>` : ''}
                                    </div>
                                `;
        }).join('')}
                        </div>
                    ` : ''}
                </div>
            </details>
        `;
    }

    setupImageViewer() {
        const modal = document.getElementById('imageViewerModal');
        const closeBtn = document.getElementById('imageViewerClose');

        // Close modal when clicking the X button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside the image
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });

        // Event delegation for image file clicks
        document.addEventListener('click', (e) => {
            const imageItem = e.target.closest('.image-file-item');
            if (imageItem) {
                const folderPath = imageItem.getAttribute('data-folder-path');
                const filename = imageItem.getAttribute('data-filename');
                if (folderPath && filename) {
                    this.showImageModal(folderPath, filename);
                }
            }
        });
    }

    showImageModal(folderPath, filename) {
        const modal = document.getElementById('imageViewerModal');
        const img = document.getElementById('imageViewerImg');
        const filenameDisplay = document.getElementById('imageViewerFilename');

        if (!modal || !img || !filenameDisplay) {
            console.error('Image viewer modal elements not found');
            return;
        }

        // Construct the file path - normalize to Windows path separators
        const separator = folderPath.includes('\\') ? '\\' : '/';
        const filePath = `${folderPath}${separator}${filename}`;

        // Use the API endpoint to serve the image
        const imageUrl = `/api/image?path=${encodeURIComponent(filePath)}`;

        // Display the image
        img.src = imageUrl;
        filenameDisplay.textContent = filename;
        modal.style.display = 'flex';

        // Handle image load error
        img.onerror = () => {
            console.error('Failed to load image:', imageUrl);
            filenameDisplay.textContent = `${filename} (Failed to load)`;
            filenameDisplay.style.color = 'var(--danger-color)';
        };

        // Reset error styling on successful load
        img.onload = () => {
            filenameDisplay.style.color = 'var(--text-primary)';
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
