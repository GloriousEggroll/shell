const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Meta, St } = imports.gi;

import * as error from 'error';
import * as lib from 'lib';
import * as log from 'log';
import * as search from 'search';
import * as window from 'window';

import type { ShellWindow } from 'window';
import type { Ext } from './extension';
import type { AppInfo } from './app_info';

const LIST_MAX = 5;
const ICON_SIZE = 32;

export class Launcher extends search.Search {
    selections: Array<ShellWindow | [string, AppInfo]>;
    active: Array<[string, any, any]>;

    constructor(ext: Ext) {
        let apps = new Array();

        let cancel = () => {
            ext.overlay.visible = false;
        };

        let search = (pattern: string): Array<[string, any, any]> | null => {
            this.selections.splice(0);
            this.active.splice(0);
            apps.splice(0);

            if (pattern.length == 0) {
                ext.overlay.visible = false;
                return null;
            }

            const needles = pattern.split(' ');

            const contains_pattern = (haystack: string, needles: Array<string>): boolean => {
                const hay = haystack.toLowerCase();
                return needles.every((n) => hay.includes(n));
            };

            // Filter matching windows
            for (const window of ext.tab_list(Meta.TabList.NORMAL, null)) {
                const retain = contains_pattern(window.name(ext), needles)
                    || contains_pattern(window.meta.get_title(), needles);

                if (retain) {
                    this.selections.push(window);
                }
            }

            // Filter matching desktop apps
            for (const [where, info] of ext.desktop_apps) {
                const retain = contains_pattern(info.name(), needles)
                    || lib.ok(info.generic_name(), (s) => contains_pattern(s, needles))
                    || lib.ok(info.comment(), (s) => contains_pattern(s, needles))
                    || lib.ok(info.categories(), (s) => contains_pattern(s, needles));

                if (retain) {
                    this.selections.push([where, info]);
                }
            }

            // Sort the list of matched selections
            this.selections.sort((a, b) => {
                const a_name = a instanceof window.ShellWindow ? a.name(ext) : a[1].name();
                const b_name = b instanceof window.ShellWindow ? b.name(ext) : b[1].name();

                return a_name.toLowerCase() > b_name.toLowerCase() ? 1 : 0;
            });

            // Truncate excess items from the list
            this.selections.splice(LIST_MAX);

            for (const selection of this.selections) {
                let data: [string, any, any];

                if (selection instanceof window.ShellWindow) {
                    let name = selection.name(ext);
                    let title = selection.meta.get_title();

                    if (name != title) {
                        name += ': ' + title;
                    }

                    data = [
                        name,
                        new St.Icon({
                            icon_name: 'focus-windows-symbolic',
                            icon_size: ICON_SIZE - 12,
                            style_class: "pop-shell-search-cat"
                        }),
                        selection.icon(ext, ICON_SIZE)
                    ];
                } else {
                    const [where, app] = selection;
                    const generic = app.generic_name();

                    data = [
                        generic ? `${generic} (${app.name()}) [${where}]` : `${app.name()} [${where}]`,
                        new St.Icon({
                            icon_name: 'applications-other',
                            icon_size: ICON_SIZE - 12,
                            style_class: "pop-shell-search-cat"
                        }),
                        new St.Icon({
                            icon_name: app.icon() ?? 'applications-other',
                            icon_size: ICON_SIZE
                        })
                    ];
                }

                this.active.push(data);
            }

            return this.active;
        };

        let select = (id: number) => {
            if (id <= this.selections.length) return;

            const selected = this.selections[id];
            if (selected instanceof window.ShellWindow) {
                const rect = selected.rect();
                ext.overlay.x = rect.x
                ext.overlay.y = rect.y;
                ext.overlay.width = rect.width;
                ext.overlay.height = rect.height;
                ext.overlay.visible = true;
            }
        };

        let apply = (id: number) => {
            const selected = this.selections[id];
            if (selected instanceof window.ShellWindow) {
                selected.activate();
                ext.overlay.visible = false;
            } else {
                const result = selected[1].launch();
                if (result instanceof error.Error) {
                    log.error(result.format());
                }
            }
        };

        super(cancel, search, select, apply);
        this.selections = new Array();
        this.active = new Array();
    }
}