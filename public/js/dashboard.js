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
    }

    displayResults(analysisResult) {
        this.data = analysisResult;
        this.render();
    }

    render() {
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent || !this.data) return;

        const { summary, catalogBreakdown, objects, emptyDirectories, dateRange } = this.data;

        dashboardContent.innerHTML = `
            <div class="dashboard">
                <!-- Header -->
                <div class="dashboard-header" style="margin-bottom: 2rem;">
                    <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">📊 Collection Dashboard</h2>
                    <p style="color: var(--text-secondary);">
                        ${this.data.path}
                    </p>
                </div>

                <!-- Summary Cards -->
                <div class="summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    ${this.renderSummaryCard('🎯', 'Total Objects', summary.totalObjects, 'primary')}
                    ${this.renderSummaryCard('📦', 'With Sub-Frames', summary.withSubFrames, 'secondary')}
                    ${this.renderSummaryCard('📁', 'Without Sub-Frames', summary.withoutSubFrames, 'accent')}
                    ${this.renderSummaryCard('💾', 'Total Size', summary.totalSizeFormatted, 'success')}
                    ${this.renderSummaryCard('📄', 'Total Files', summary.totalFiles, 'info')}
                    ${summary.emptyDirectories > 0 ? this.renderSummaryCard('⚠️', 'Empty Folders', summary.emptyDirectories, 'warning') : ''}
                </div>

                <!-- File Type Breakdown -->
                <div class="file-breakdown" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">📊 File Types</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        ${this.renderFileStat('.FIT Files', summary.fitFiles)}
                        ${this.renderFileStat('.JPG Files', summary.jpgFiles)}
                        ${summary.mp4Files > 0 ? this.renderFileStat('🎥 Videos (.MP4)', summary.mp4Files) : ''}
                        ${this.renderFileStat('Thumbnails', summary.thumbnails)}
                    </div>
                </div>

                <!-- Catalog Breakdown -->
                ${this.renderCatalogBreakdown(catalogBreakdown)}

                <!-- Date Range -->
                ${dateRange.oldest && dateRange.newest ? this.renderDateRange(dateRange) : ''}

                <!-- Empty Directories Warning -->
                ${emptyDirectories && emptyDirectories.length > 0 ? this.renderEmptyDirectories(emptyDirectories) : ''}

                <!-- Sub-Frame Cleanup Section -->
                ${this.renderSubFrameCleanup(objects)}

                <!-- Objects List -->
                ${this.renderObjectsList(objects)}
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
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem;
                                    background: var(--bg-tertiary); border-radius: 8px;">
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

    renderDateRange(dateRange) {
        const oldest = new Date(dateRange.oldest);
        const newest = new Date(dateRange.newest);

        return `
            <div class="date-range" style="background: var(--bg-card); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">📅 Date Range</h3>
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 2rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Oldest Capture</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${oldest.toLocaleDateString()}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Newest Capture</div>
                        <div style="font-size: 1.25rem; font-weight: 600;">${newest.toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
        `;
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
                        <th style="padding: 1rem; text-align: right;">Integration</th>
                        <th style="padding: 1rem; text-align: right;">Files</th>
                        <th style="padding: 1rem; text-align: right;">Size</th>
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

        return `
            <tr class="object-row" data-object-name="${obj.name.toLowerCase()}" data-catalog="${obj.catalog.toLowerCase()}"
                style="background: ${bgColor}; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;"
                onmouseenter="this.style.background='var(--bg-secondary)'"
                onmouseleave="this.style.background='${bgColor}'">
                <td style="padding: 1rem;">
                    <strong>${obj.displayName}</strong>
                    ${obj.isMosaic ? '<span style="font-size: 0.75rem; background: var(--accent-color); color: black; padding: 0.125rem 0.5rem; border-radius: 4px; margin-left: 0.5rem;">Mosaic</span>' : ''}
                </td>
                <td style="padding: 1rem; color: var(--text-secondary);">${obj.catalog}</td>
                <td style="padding: 1rem; text-align: center;">
                    ${obj.hasSubFrames ? '<span style="color: var(--success-color);">✓</span>' : '<span style="color: var(--text-muted);">✗</span>'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace; color: var(--text-secondary);">
                    ${obj.totalIntegrationTime > 0 ? this.formatIntegrationTime(obj.totalIntegrationTime) : '-'}
                </td>
                <td style="padding: 1rem; text-align: right; font-family: monospace;">${totalFiles}</td>
                <td style="padding: 1rem; text-align: right; font-family: monospace;">${app.formatBytes(totalSize)}</td>
            </tr>
        `;
    }

    attachEventListeners() {
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
