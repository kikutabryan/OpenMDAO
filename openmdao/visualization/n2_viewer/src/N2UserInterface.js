/**
 * Manage info for each node metadata property
 * @typedef InfoPropDefault
 * @property {String} key The identifier of the property.
 * @property {String} desc The description (label) to display.
 * @property {Boolean} capitalize Whether to capitialize every word in the desc.
 */
class InfoPropDefault {
    constructor(key, desc, capitalize = false) {
        this.key = key;
        this.desc = desc;
        this.capitalize = capitalize;
    }

    /** Return the same message since this is the base class */
    output(msg) { return msg; }

    canShow(obj) { return (obj.propExists(this.key) && obj[this.key] != '') }
}

/**
 * Outputs a Yes or No to display. 
 * @typedef InfoPropYesNo
 */
class InfoPropYesNo extends InfoPropDefault {
    constructor(key, desc, capitalize = false, showIfFalse = false) {
        super(key, desc, capitalize);
        this.showIfFalse = showIfFalse;
    }

    /** Return Yes or No when given True or False */
    output(boolVal) { return boolVal ? 'Yes' : 'No'; }

    canShow(obj) { return (obj.propExists(this.key) && obj[this.key] != '' && this.showIfFalse == false )}
}

/**
 * Rename params to inputs and unknowns to outputs. 
 * @typedef InfoUpdateType
 */
class InfoUpdateType extends InfoPropDefault {
    constructor(key, desc, capitalize = false) {
        super(key, desc, capitalize);
    }

    /** Replace the old terms with new ones */
    output(msg) {
        return msg
            .replace(/param/, 'input')
            .replace(/unknown/, 'output')
            .replace('_', ' ');
    }
}

/** Convert an array to a string that is human readable.
 * @param {array} arr The array to convert.
 * @param {level} int The level of nesting in the display.
 * @returns {str} the string of the converted array.
 */
function array_to_string(array, level=0){
    let indent = ' '.repeat(level);
    let s = indent + '[';
    for (const element of array) {
        if (Array.isArray(element)) {
            s += array_to_string(element,level+1);
        } else {
            s += element.toString() ;
        }
        s += ' ';
    }
    if (array.length > 0) {
        s = s.slice(0, -1); // chop off the last space
    }
    s += ']\n';
    return s;
}

/** Convert an array to a string that can be used in code.
 * @param {array} arr The array to convert.
 * @returns {str} the string of the converted array.
 */
function array_to_copy_string(array){
    let s = '[';
    for (const element of array) {
        if (Array.isArray(element)) {
            s += array_to_copy_string(element);
        } else {
            s += element.toString() ;
        }
        s += ', ';
    }
    if (array.length > 0) {
        s = s.slice(0, -2); // chop off the last comma and space
    }
    s += ']';
    return s;
}

/**
 * Handles properties that are arrays.
 * @typedef InfoPropArray
 */
class InfoPropArray extends InfoPropDefault {
    constructor(key, desc, capitalize = false) {
        super(key, desc, capitalize);
    }

    /** Return Yes or No when given True or False */
    output(array) {
        return array;
    }

    canShow(obj) { return (obj.propExists(this.key) && obj[this.key] != '' )}
}

/**
 * Manage a window for displaying the value of a variable.
 * @typedef ValueInfo
 */
class ValueInfo {
    /**
     * Build a list of the properties we care about and set up
     * references to the HTML elements.
     * @param {Object} abs2prom Object containing promoted variable names.
     */
    constructor(abs2prom) {
        this.abs2prom = abs2prom;
        this.container = d3.select('#node-value-container');
        this.table = d3.select('#node-value-table');
        this.header = d3.select('#node-value-header');
        this.title = d3.select('#node-value-title');
        this.thead = this.table.select('thead');
        this.tbody = this.table.select('tbody');
        this.hidden = true;
        this.pinned = false;

        const self = this;
        this.name = null;
        this.TRUNCATE_LIMIT = 80; // if the string version of the variable is longer than this, truncate

        d3.select('.close-value-window-button').on(
            'click',
            function () {
                self.hide();
            }
        );

        this._setupDrag();
        this._setupResizerDrag();
    }

    show() {
        this.container.style('visibility', 'visible');
    }

    hide() {
        this.container.style('visibility', 'hidden');
    }

    showMoreButtonDisplayed(val) {  //
        if (!val) return false; // if no value, cannot display! Need to check this

        if (!Array.isArray(val)) return false ; // scalars don't need separate display

        // Now we know it is an array

        // Handle 1-D array
        if (!Array.isArray(val[0])) {
            // 1-D array
            if (val.length < this.TRUNCATE_LIMIT) {
                // too short to need separate window
                return false;
            }
        }

        // Handle 2-D array
        if (!Array.isArray(val[0][0])) {
            return true;
        }

        // More than 3-D array - punt for now
        return false;
    }

    update(name, val) {
        this.title.text("Initial value for " + name);

        // Check to see if the data is a 2d array since the rest of the code assumes that it is an Array
        // If only 1d, make it a 2d with one row
        if (!Array.isArray(val[0])){
            val = [val];
        }

        var tbody = this.table.append("tbody");
        var rows = tbody.selectAll('tr').data(val).enter().append('tr')
        var cells = rows.selectAll('td')
            .data(function(row) {
                return row;
        })
        .enter()
        .append('td')
        .text(function (d) {
            return d;
        })
    }

    clear() {
        this.table.html('');
    }

        /** Listen for the event to begin dragging the legend */
    _setupDrag() {
        const self = this;

        this.title.on('mousedown', function() {
            d3.select('#node-value-title').style('cursor', 'grabbing');
            let dragDiv = d3.select('#node-value-container');
            dragDiv.style('cursor', 'grabbing')
                // top style needs to be set explicitly before releasing bottom:
                .style('top', dragDiv.style('top'))
                .style('bottom', 'initial');

            self._startPos = [d3.event.clientX, d3.event.clientY]
            self._offset = [d3.event.clientX - parseInt(dragDiv.style('left')),
                d3.event.clientY - parseInt(dragDiv.style('top'))];

            let w = d3.select(window)
                .on("mousemove", e => {
                    dragDiv
                        .style('top', (d3.event.clientY - self._offset[1]) + 'px')
                        .style('left', (d3.event.clientX - self._offset[0]) + 'px');
                })
                .on("mouseup", e => {
                    dragDiv.style('cursor', 'grab');
                    w.on("mousemove", null).on("mouseup", null);

                });

            d3.event.preventDefault();
        })
    }

        /** Set up event handlers for grabbing the bottom corner and dragging */
    _setupResizerDrag() {
        const handle = d3.select('#node-value-resizer-handle');
        const body = d3.select('body');
        const tableDiv = d3.select('#node-value-table-div');

        handle.on('mousedown', e => {
            const startPos = {
                'x': d3.event.clientX,
                'y': d3.event.clientY
            };
            const startDims = {
                'width': parseInt(tableDiv.style('width')),
                'height': parseInt(tableDiv.style('height'))
            };
            body.style('cursor', 'nwse-resize')
                .on('mouseup', e => {
                    // Get rid of the drag event handlers
                    body.style('cursor', 'default')
                        .on('mousemove', null)
                        .on('mouseup', null);
                })
                .on('mousemove', e => {
                    const newWidth = d3.event.clientX - startPos.x + startDims.width;
                    const newHeight = d3.event.clientY - startPos.y + startDims.height;

                    tableDiv.style('width', newWidth + 'px');
                    tableDiv.style('height', newHeight + 'px');
                });

            d3.event.preventDefault();
        });

    }
}

/**
 * Manage a table containing all available metadata properties for
 * the currently active node, as well as whether the table is
 * visible or not.
 * @typedef NodeInfo
 */
class NodeInfo {
    /**
     * Build a list of the properties we care about and set up
     * references to the HTML elements.
     * @param {Object} abs2prom Object containing promoted variable names.
     */
    constructor(abs2prom, valueInfo) {
        this.propList = [
            new InfoPropDefault('absPathName', 'Absolute Name'),
            new InfoPropDefault('class', 'Class'),
            new InfoUpdateType('type', 'Type', true),
            new InfoPropDefault('dtype', 'DType'),

            new InfoPropDefault('units', 'Units'),
            new InfoPropDefault('shape', 'Shape'),
            new InfoPropYesNo('is_discrete', 'Discrete'),
            new InfoPropYesNo('distributed', 'Distributed'),
            new InfoPropArray('value', 'Value'),

            new InfoPropDefault('subsystem_type', 'Subsystem Type', true),
            new InfoPropDefault('component_type', 'Component Type', true),
            new InfoPropYesNo('implicit', 'Implicit'),
            new InfoPropYesNo('is_parallel', 'Parallel'),
            new InfoPropDefault('linear_solver', 'Linear Solver'),
            new InfoPropDefault('nonlinear_solver', 'Non-Linear Solver'),
            new InfoPropDefault('options', 'Options')
        ];

        this.abs2prom = abs2prom;
        this.table = d3.select('#node-info-table');
        this.container = d3.select('#node-info-container');
        this.thead = this.table.select('thead');
        this.tbody = this.table.select('tbody');
        this.toolbarButton = d3.select('#info-button');
        this.hidden = true;
        this.pinned = false;

        const self = this;
        this.pinButton = d3.select('#node-info-pin')
            .on('click', e => { self.unpin(); })
        this.name = null;

        this.valueInfo = valueInfo;
    }

    /** Make the info box visible if it's hidden */
    show() {
        this.toolbarButton.attr('class', 'fas icon-info-circle active-tab-icon');
        this.hidden = false;
        d3.select('#all_pt_n2_content_div').classed('node-data-cursor', true);
    }

    /** Make the info box hidden if it's visible */
    hide() {
        this.toolbarButton.attr('class', 'fas icon-info-circle');
        this.hidden = true;
        d3.select('#all_pt_n2_content_div').classed('node-data-cursor', false);
    }

    /** Toggle the visibility setting */
    toggle() {
        if (this.hidden) this.show();
        else this.hide();
    }

    pin() { 
        this.pinned = true;
        this.pinButton.attr('class', 'info-visible');
    }
    
    unpin() {
        this.pinned = false;
        this.pinButton.attr('class', 'info-hidden');
        this.clear();

        const d = d3.select("#node-value-div");
        d.style('visibility', 'hidden');

        this.valueInfo.clear();
        this.valueInfo.hide();
    }

    togglePin() {
        if (this.pinned) this.unpin();
        else this.pin();
    }

    _addPropertyRow(label, val, capitalize = false) {

        if ( label != 'Options'){
            const newRow = this.tbody.append('tr');

            const th = newRow.append('th')
                .attr('scope', 'row')
                .text(label)

            var nodeInfoVal = val ;
            let td;
            if ( label === 'Value') {
                if ( val == null ) {
                    td = newRow.append('td')
                            .html("Value too large to include in N2" );
                } else {
                    var val_string = array_to_string(val)
                    var max_length = this.valueInfo.TRUNCATE_LIMIT;
                    var isTruncated = val_string.length > max_length ;
                    var nodeInfoVal = isTruncated ?
                        val_string.substring(0, max_length - 3) + "..." :
                        val_string;

                    let html = nodeInfoVal;
                    // if ( this.valueInfo.showMoreButtonDisplayed(val) ){
                    if ( isTruncated ){
                        html += " <button type='button' class='show_value_button'>Show more</button>" ;
                    }
                    html += " <button type='button' class='copy_value_button'>Copy</button>" ;
                    td = newRow.append('td').html(html);

                    // if ( this.valueInfo.showMoreButtonDisplayed(val) ) {
                    if ( isTruncated ) {
                        var showValueButton = td.select('.show_value_button');
                        const self = this;
                        showValueButton.on('click', function () {
                            self.valueInfo.update(self.name, val);
                            self.valueInfo.show();
                        });
                    }
                    // Copy value button
                    var copyValueButton = td.select('.copy_value_button');
                    copyValueButton.on('click',
                           function () {
                                // This is the strange way you can get something on the clipboard
                                var copyText = document.querySelector("#input");
                                copyText.value = 'array(' + array_to_copy_string(val)  + ')';
                                copyText.select();
                                document.execCommand("copy");
                           }
                    );
                }
            }
            else {
                td = newRow.append('td')
                        .text(nodeInfoVal);

            }
            if (capitalize) td.attr('class', 'caps');
        } else {
            // Add Options to the Node Info table
            if ( Object.keys(val).length !== 0 ){
                const tr = this.tbody.append('th').text("Options").attr('colspan', '2').attr('class', 'options-header');
                for (const key in val) {
                    const tr = this.tbody.append('tr');
                    const th = tr.append('th').text(key);
                    let v;
                    if (val[key] === null) {
                        v = "None";
                    } else {
                        v = val[key];
                    }
                    const td = tr.append('td').text(v);
                }
            }
        }
    }

    /**
     * Iterate over the list of known properties and display them
     * if the specified object contains them.
     * @param {Object} event The related event so we can get position.
     * @param {N2TreeNode} obj The node to examine.
     * @param {N2TreeNode} color The color to make the title bar.
     */
    update(event, obj, color = '#42926b') {
        if (this.hidden || this.pinned) return;

        this.clear();
        // Put the name in the title
        this.table.select('thead th')
            .style('background-color', color)
            .text(obj.name);

        this.name = obj.absPathName;

        this.table.select('tfoot th')
            .style('background-color', color);

        if (this.abs2prom) {
            if (obj.isParam()) {
                this._addPropertyRow('Promoted Name', this.abs2prom.input[obj.absPathName]);
            }
            else if (obj.isUnknown()) {
                this._addPropertyRow('Promoted Name', this.abs2prom.output[obj.absPathName]);
            }
        }

        for (const prop of this.propList) {
            // if (obj.propExists(prop.key) && obj[prop.key] != '') {
            if (prop.key === 'value') {
                if (obj.hasOwnProperty('value')) {
                    this._addPropertyRow(prop.desc, prop.output(obj[prop.key]), prop.capitalize)
                }
            } else {
                if (prop.canShow(obj)) {
                    this._addPropertyRow(prop.desc, prop.output(obj[prop.key]), prop.capitalize)
                }
            }
        }

        // Solidify the size of the table after populating so that
        // it can be positioned reliably by move().
        this.table
            .style('width', this.table.node().scrollWidth + 'px')
            .style('height', this.table.node().scrollHeight + 'px')

        this.move(event);
        this.container.attr('class', 'info-visible');
    }

    /** Wipe the contents of the table body */
    clear() {
        if (this.hidden || this.pinned) return;
        this.container
            .attr('class', 'info-hidden')
            .style('width', 'auto')
            .style('height', 'auto');

        this.table
            .style('width', 'auto')
            .style('height', 'auto');

        this.tbody.html('');
    }

    /**
     * Relocate the table to a position near the mouse
     * @param {Object} event The triggering event containing the position.
     */
    move(event) {
        if (this.hidden || this.pinned) return;
        const offset = 30;

        // Mouse is in left half of window, put box to right of mouse
        if (event.clientX < window.innerWidth / 2) {
            this.container.style('right', 'auto');
            this.container.style('left', (event.clientX + offset) + 'px')
        }
        // Mouse is in right half of window, put box to left of mouse
        else {
            this.container.style('left', 'auto');
            this.container.style('right', (window.innerWidth - event.clientX + offset) + 'px')
        }

        // Mouse is in top half of window, put box below mouse
        if (event.clientY < window.innerHeight / 2) {
            this.container.style('bottom', 'auto');
            this.container.style('top', (event.clientY - offset) + 'px')
        }
        // Mouse is in bottom half of window, put box above mouse
        else {
            this.container.style('top', 'auto');
            this.container.style('bottom', (window.innerHeight - event.clientY - offset) + 'px')
        }
    }
}

/**
 * Handle input events for the matrix and toolbar.
 * @typedef N2UserInterface
 * @property {N2Diagram} n2Diag Reference to the main diagram.
 * @property {N2TreeNode} leftClickedNode The last node that was left-clicked.
 * @property {N2TreeNode} rightClickedNode The last node that was right-clicked, if any.
 * @property {Boolean} lastClickWasLeft True is last mouse click was left, false if right.
 * @property {Boolean} leftClickIsForward True if the last node clicked has a greater depth
 *  than the current zoomed element.
 * @property {Array} backButtonHistory The stack of forward-navigation zoomed elements.
 * @property {Array} forwardButtonHistory The stack of backward-navigation zoomed elements.
 */

class N2UserInterface {
    /**
     * Initialize properties, set up the collapse-depth menu, and set up other
     * elements of the toolbar.
     * @param {N2Diagram} n2Diag A reference to the main diagram.
     */
    constructor(n2Diag) {
        this.n2Diag = n2Diag;

        this.leftClickedNode = document.getElementById('ptN2ContentDivId');
        this.rightClickedNode = null;
        this.lastClickWasLeft = true;
        this.leftClickIsForward = true;
        this.findRootOfChangeFunction = null;
        this.callSearchFromEnterKeyPressed = false;

        this.backButtonHistory = [];
        this.forwardButtonHistory = [];

        this._setupCollapseDepthElement();
        this.updateClickedIndices();
        this._setupSearch();
        this._setupResizerDrag();
        this._setupWindowResizer();

        this.legend = new N2Legend(this.n2Diag.modelData);
        this.valueInfoBox = new ValueInfo(this.n2Diag.model.abs2prom);
        this.nodeInfoBox = new NodeInfo(this.n2Diag.model.abs2prom, this.valueInfoBox);
        this.toolbar = new N2Toolbar(this);
    }

    /** Set up the menu for selecting an arbitrary depth to collapse to. */
    _setupCollapseDepthElement() {
        let self = this;

        let collapseDepthElement = this.n2Diag.dom.parentDiv.querySelector(
            '#depth-slider'
        );

        collapseDepthElement.max = this.n2Diag.model.maxDepth - 1;
        collapseDepthElement.value = collapseDepthElement.max;

        collapseDepthElement.onmouseup = function (e) {
            const modelDepth = parseInt(e.target.value);
            self.collapseToDepthSelectChange(modelDepth);
        };
    }

    /** Set up event handlers for grabbing the bottom corner and dragging */
    _setupResizerDrag() {
        const handle = d3.select('#n2-resizer-handle');
        const box = d3.select('#n2-resizer-box');
        const body = d3.select('body');

        handle.on('mousedown', e => {
            box
                .style('top', n2Diag.layout.gapSpace)
                .style('bottom', n2Diag.layout.gapSpace);

            handle.attr('class', 'active-resizer-handle');
            box.attr('class', 'active-resizer-box');

            const startPos = {
                'x': d3.event.clientX,
                'y': d3.event.clientY
            };
            const startDims = {
                'width': parseInt(box.style('width')),
                'height': parseInt(box.style('height'))
            };
            const offset = {
                'x': startPos.x - startDims.width,
                'y': startPos.y - startDims.height
            };
            let newDims = {
                'x': startDims.width,
                'y': startDims.height
            };

            handle.html(Math.round(newDims.x) + ' x ' + newDims.y);

            body.style('cursor', 'nwse-resize')
                .on('mouseup', e => {
                    n2Diag.manuallyResized = true;

                    // Update the slider value and display
                    const defaultHeight = window.innerHeight * .95;
                    const newPercent = Math.round((newDims.y / defaultHeight) * 100);
                    d3.select('#model-slider').node().value = newPercent;
                    d3.select('#model-slider-label').html(newPercent + "%");

                    // Perform the actual resize
                    n2Diag.verticalResize(newDims.y);

                    box.style('width', null).style('height', null);

                    // Turn off the resizing box border and handle
                    handle.attr('class', 'inactive-resizer-handle');
                    box.attr('class', 'inactive-resizer-box');

                    // Get rid of the drag event handlers
                    body.style('cursor', 'default')
                        .on('mousemove', null)
                        .on('mouseup', null);
                })
                .on('mousemove', e => {
                    const newHeight = d3.event.clientY - offset.y;
                    if (newHeight + n2Diag.layout.gapDist * 2 >= window.innerHeight * .5) {
                        newDims = {
                            'x': d3.event.clientX - offset.x,
                            'y': newHeight
                        };

                        // Maintain the ratio by only resizing in the least moved direction
                        // and resizing the other direction by a fraction of that
                        if (newDims.x < newDims.y) {
                            newDims.y = n2Diag.layout.calcHeightBasedOnNewWidth(newDims.x);
                        }
                        else {
                            newDims.x = n2Diag.layout.calcWidthBasedOnNewHeight(newDims.y);
                        }

                        box
                            .style('width', newDims.x + 'px')
                            .style('height', newDims.y + 'px');

                        handle.html(Math.round(newDims.x) + ' x ' + newDims.y);
                    }
                });

            d3.event.preventDefault();
        });

    }

    /** Respond to window resize events if the diagram hasn't been manually sized */
    _setupWindowResizer() {
        const self = this;
        const n2Diag = self.n2Diag;
        this.pixelRatio = window.devicePixelRatio;

        self.resizeTimeout = null;
        d3.select(window).on('resize', function () {
            const newPixelRatio = window.devicePixelRatio;

            // If the browser window itself is zoomed, don't do anything
            if (newPixelRatio != self.pixelRatio) {
                self.pixelRatio = newPixelRatio;
                return;
            }

            if (!n2Diag.manuallyResized) {
                clearTimeout(self.resizeTimeout);
                self.resizeTimeout =
                    setTimeout(function () {
                        n2Diag.verticalResize(window.innerHeight * .95);
                    }, 200);
            }
        })
    }

    /**
     * Make sure the clicked node is deeper than the zoomed node, that
     * it's not the root node, and that it actually has children.
     * @param {N2TreeNode} node The right-clicked node to check.
     */
    isCollapsible(node) {
        return (node.depth > this.n2Diag.zoomedElement.depth &&
            node.type !== 'root' && node.hasChildren());
    }

    /**
     * When a node is right-clicked or otherwise targeted for collapse, make sure it
     * it's allowed, then set the node as minimized and update the diagram drawing.
     */
    collapse() {
        testThis(this, 'N2UserInterface', 'collapse');

        let node = this.rightClickedNode;

        if (this.isCollapsible(node)) {

            if (this.collapsedRightClickNode !== undefined) {
                this.rightClickedNode = this.collapsedRightClickNode;
                this.collapsedRightClickNode = undefined;
            }

            this.findRootOfChangeFunction =
                this.findRootOfChangeForRightClick.bind(this);

            N2TransitionDefaults.duration = N2TransitionDefaults.durationFast;
            this.lastClickWasLeft = false;
            node.toggleMinimize();
            this.n2Diag.update();
        }
    }

    /**
     * When a node is right-clicked, collapse it if it's allowed.
     * @param {N2TreeNode} node The node that was right-clicked.
     */
    rightClick(node) {
        testThis(this, 'N2UserInterface', 'rightClick');

        d3.event.preventDefault();
        d3.event.stopPropagation();

        if (node.isMinimized) {
            this.rightClickedNode = node;
            this.addBackButtonHistory();
            this._uncollapse(node);
            this.n2Diag.update();
        }
        else if (this.isCollapsible(node)) {
            this.rightClickedNode = node;
            node.collapsable = true;

            this.addBackButtonHistory();
            this.collapse();
        }
    }

    /**
     * Update states as if a left-click was performed, which may or may not have
     * actually happened.
     * @param {N2TreeNode} node The node that was targetted.
     */
    _setupLeftClick(node) {
        this.leftClickedNode = node;
        this.lastClickWasLeft = true;
        if (this.leftClickedNode.depth > this.n2Diag.zoomedElement.depth) {
            this.leftClickIsForward = true; // forward
        }
        else if (this.leftClickedNode.depth < this.n2Diag.zoomedElement.depth) {
            this.leftClickIsForward = false; // backwards
        }
        this.n2Diag.updateZoomedElement(node);
        N2TransitionDefaults.duration = N2TransitionDefaults.durationFast;
    }

    /**
     * React to a left-clicked node by zooming in on it.
     * @param {N2TreeNode} node The targetted node.
     */
    leftClick(node) {
        testThis(this, 'N2UserInterface', 'leftClick');
        d3.event.preventDefault();
        d3.event.stopPropagation();

        if (!node.hasChildren() || node.isParam()) return;
        if (d3.event.button != 0) return;
        this.addBackButtonHistory();
        this._setupLeftClick(node);

        this.n2Diag.update();
    }

    /**
     * Set up for an animated transition by setting and remembering where things were.
     */
    updateClickedIndices() {
        enterIndex = exitIndex = 0;
        if (this.lastClickWasLeft) {
            if (this.leftClickIsForward) {
                exitIndex =
                    this.leftClickedNode.rootIndex -
                    this.n2Diag.zoomedElementPrev.rootIndex;
            }
            else {
                enterIndex =
                    this.n2Diag.zoomedElementPrev.rootIndex -
                    this.leftClickedNode.rootIndex;
            }
        }
    }

    /**
     * Preserve the current zoomed element and state of all hidden elements.
     * @param {Boolean} clearForward If true, erase the forward history.
     */
    addBackButtonHistory(clearForward = true) {
        let formerHidden = [];
        this.n2Diag.findAllHidden(formerHidden, false);

        this.backButtonHistory.push({
            'node': this.n2Diag.zoomedElement,
            'hidden': formerHidden
        });

        if (clearForward) this.forwardButtonHistory = [];
    }

    /**
     * Preserve the specified node as the zoomed element,
     * and remember the state of all hidden elements.
     * @param {N2TreeNode} node The node to preserve as the zoomed element.
     */
    addForwardButtonHistory(node) {
        let formerHidden = [];
        this.n2Diag.findAllHidden(formerHidden, true);

        this.forwardButtonHistory.push({
            'node': node,
            'hidden': formerHidden
        });
    }

    /**
     * When the back history button is clicked, pop the top node from that
     * history stack, and disable the button if the stack is empty. Find the
     * neared un-minimized node (if not the node itself) and zoom to that.
     * Add the previous zoomed node to the forward history stack.
     */
    backButtonPressed() {
        testThis(this, 'N2UserInterface', 'backButtonPressed');

        if (this.backButtonHistory.length == 0) {
            debugInfo("backButtonPressed(): no items in history");
            return;
        }

        debugInfo("backButtonPressed(): " +
            this.backButtonHistory.length + " items in history");

        const history = this.backButtonHistory.pop();
        const node = history.node;

        // Check to see if the node is a collapsed node or not
        if (node.collapsable) {
            this.leftClickedNode = node;
            this.addForwardButtonHistory(node);
            this.collapse();
        }
        else {
            for (let obj = node; obj != null; obj = obj.parent) {
                //make sure history item is not minimized
                if (obj.isMinimized) return;
            }

            this.addForwardButtonHistory(this.n2Diag.zoomedElement);
            this._setupLeftClick(node);
        }

        this.n2Diag.resetAllHidden(history.hidden);
        this.n2Diag.update();
    }

    /**
     * When the forward history button is clicked, pop the top node from that
     * history stack, and disable the button if the stack is empty. Find the
     * neared un-minimized node (if not the node itself) and zoom to that.
     * Add the previous zoomed node to the back history stack.
     */
    forwardButtonPressed() {
        testThis(this, 'N2UserInterface', 'forwardButtonPressed');

        if (this.forwardButtonHistory.length == 0) {
            debugInfo("forwardButtonPressed(): no items in history");
            return;
        }

        debugInfo("forwardButtonPressed(): " +
            this.forwardButtonHistory.length + " items in history");

        const history = this.forwardButtonHistory.pop();
        const node = history.node;

        d3.select('#redo-graph').classed('disabled-button',
            (this.forwardButtonHistory.length == 0));

        for (let obj = node; obj != null; obj = obj.parent) {
            // make sure history item is not minimized
            if (obj.isMinimized) return;
        }

        this.addBackButtonHistory(false);
        this._setupLeftClick(node);

        this.n2Diag.resetAllHidden(history.hidden);
        this.n2Diag.update();
    }

    /**
     * When the last event to change the zoom level was a right-click,
     * return the targetted node. Called during drawing/transition.
     * @returns The last right-clicked node.
     */
    findRootOfChangeForRightClick() {
        return this.rightClickedNode;
    }

    /**
     * When the last event to change the zoom level was the selection
     * from the collapse depth menu, return the node with the
     * appropriate depth.
     * @returns The node that has the selected depth if it exists.
     */
    findRootOfChangeForCollapseDepth(node) {
        for (let obj = node; obj != null; obj = obj.parent) {
            //make sure history item is not minimized
            if (obj.depth == this.n2Diag.chosenCollapseDepth) return obj;
        }
        return node;
    }

    /**
     * When either of the collapse or uncollapse toolbar buttons are
     * pressed, return the parent component of the targetted node if
     * it has one, or the node itself if not.
     * @returns Parent component of output node or node itself.
     */
    findRootOfChangeForCollapseUncollapseOutputs(node) {
        return node.hasOwnProperty('parentComponent') ?
            node.parentComponent :
            node;
    }

    /**
     * When the home button (aka return-to-root) button is clicked, zoom
     * to the root node.
     */
    homeButtonClick() {
        testThis(this, 'N2UserInterface', 'homeButtonClick');

        this.addBackButtonHistory();
        this._setupLeftClick(this.n2Diag.model.root);
        this.uncollapseButtonClick(this.n2Diag.model.root);
    }

    /**
     * Minimize the specified node and recursively minimize its children.
     * @param {N2TreeNode} node The current node to operate on.
     */
    _collapseOutputs(node) {
        if (node.subsystem_type && node.subsystem_type == 'component') {
            node.isMinimized = true;
        }
        if (node.hasChildren()) {
            for (let child of node.children) {
                this._collapseOutputs(child);
            }
        }
    }

    /**
     * React to a button click and collapse all outputs of the specified node.
     * @param {N2TreeNode} node The initial node, usually the currently zoomed element.
     */
    collapseOutputsButtonClick(startNode) {
        testThis(this, 'N2UserInterface', 'collapseOutputsButtonClick');

        this.addBackButtonHistory();
        this.findRootOfChangeFunction = this.findRootOfChangeForCollapseUncollapseOutputs;
        N2TransitionDefaults.duration = N2TransitionDefaults.durationSlow;
        this.lastClickWasLeft = false;
        this._collapseOutputs(startNode);
        this.n2Diag.update();
    }

    /**
     * Mark this node and all of its children as unminimized/unhidden
     * @param {N2TreeNode} node The node to operate on.
     */
    _uncollapse(node) {
        node.isMinimized = false;
        node.varIsHidden = false;

        if (node.hasChildren()) {
            for (let child of node.children) {
                this._uncollapse(child);
            }
        }
    }

    /**
     * React to a button click and uncollapse the specified node.
     * @param {N2TreeNode} startNode The initial node.
     */
    uncollapseButtonClick(startNode) {
        testThis(this, 'N2UserInterface', 'uncollapseButtonClick');

        this.addBackButtonHistory();
        this.findRootOfChangeFunction = this.findRootOfChangeForCollapseUncollapseOutputs;
        N2TransitionDefaults.duration = N2TransitionDefaults.durationSlow;
        this.lastClickWasLeft = false;
        this._uncollapse(startNode);
        this.n2Diag.update();
    }

    /**
     * Recursively minimize non-parameter nodes to the specified depth.
     * @param {N2TreeNode} node The node to work on.
     * @param {Number} depth If the node's depth is the same or more, collapse it.
     */
    _collapseToDepth(node, depth) {
        if (node.isParamOrUnknown()) {
            return;
        }

        node.isMinimized = node.depth < depth ? false : true;

        if (node.hasChildren()) {
            for (let child of node.children) {
                this._collapseToDepth(child, depth);
            }
        }
    }

    /**
     * React to a new selection in the collapse-to-depth drop-down.
     * @param {Number} newChosenCollapseDepth Selected depth to collapse to.
     */
    collapseToDepthSelectChange(newChosenCollapseDepth) {
        testThis(this, 'N2UserInterface', 'collapseToDepthSelectChange');

        this.addBackButtonHistory();
        this.n2Diag.chosenCollapseDepth = newChosenCollapseDepth;
        if (this.n2Diag.chosenCollapseDepth > this.n2Diag.zoomedElement.depth) {
            this._collapseToDepth(
                this.n2Diag.model.root,
                this.n2Diag.chosenCollapseDepth
            );
        }
        this.findRootOfChangeFunction = this.findRootOfChangeForCollapseDepth.bind(
            this
        );
        N2TransitionDefaults.duration = N2TransitionDefaults.durationSlow;
        this.lastClickWasLeft = false;
        this.n2Diag.update();
    }

    /**
     * React to the toggle-solver-name button press and show non-linear if linear
     * is currently shown, and vice-versa.
     */
    toggleSolverNamesCheckboxChange() {
        testThis(this, 'N2UserInterface', 'toggleSolverNamesCheckboxChange');

        this.n2Diag.toggleSolverNameType();
        this.n2Diag.dom.parentDiv.querySelector(
            '#linear-solver-button'
        ).className = !this.n2Diag.showLinearSolverNames ?
                'fas icon-nonlinear-solver solver-button' :
                'fas icon-linear-solver solver-button';

        this.legend.toggleSolvers(this.n2Diag.showLinearSolverNames);

        if (this.legend.shown)
            this.legend.show(
                this.n2Diag.showLinearSolverNames,
                this.n2Diag.style.solvers
            );
        this.n2Diag.update();
    }

    /** React to the toggle legend button, and show or hide the legend below the N2. */
    toggleLegend() {
        testThis(this, 'N2UserInterface', 'toggleLegend');
        this.legend.toggle();

        d3.select('#legend-button').attr('class',
            this.legend.hidden ? 'fas icon-key' : 'fas icon-key active-tab-icon');
    }

    toggleNodeData() {
        testThis(this, 'N2UserInterface', 'toggleNodeData');

        const infoButton = d3.select('#info-button');
        const nodeData = d3.select('#node-info-table');

        if (nodeData.classed('info-hidden')) {
            nodeData.attr('class', 'info-visible');
            infoButton.attr('class', 'fas icon-info-circle active-tab-icon');
        }
        else {
            nodeData.attr('class', 'info-hidden');
            infoButton.attr('class', 'fas icon-info-circle');
        }
    }

    _setupSearch() {
        let self = this; // For callbacks that change "this". Alternative to using .bind().

        // Keyup so it will be after the input and awesomplete-selectcomplete event listeners
        window.addEventListener(
            'keyup',
            self.searchEnterKeyUpEventListener.bind(self),
            true
        );

        // Keydown so it will be before the input and awesomplete-selectcomplete event listeners
        window.addEventListener(
            'keydown',
            self.searchEnterKeyDownEventListener.bind(self),
            true
        );
    }

    /** Make sure UI controls reflect history and current reality. */
    update() {
        testThis(this, 'N2UserInterface', 'update');

        d3.select('#undo-graph').classed('disabled-button',
            (this.backButtonHistory.length == 0));
        d3.select('#redo-graph').classed('disabled-button',
            (this.forwardButtonHistory.length == 0));
    }

    /** Called when the search button is actually or effectively clicked to start a search. */
    searchButtonClicked() {
        testThis(this, 'N2UserInterface', 'searchButtonClicked');
        this.addBackButtonHistory();
        this.n2Diag.search.performSearch();

        this.findRootOfChangeFunction = this.n2Diag.search.findRootOfChangeForSearch;
        N2TransitionDefaults.duration = N2TransitionDefaults.durationSlow;
        this.lastClickWasLeft = false;
        this.n2Diag.search.updateRecomputesAutoComplete = false;
        this.n2Diag.update();
    }

    /**
     * Called when the enter key is pressed in the search input box.
     * @param {Event} e Object with information about the event.
     */
    searchEnterKeyDownEventListener(e) {
        testThis(this, 'N2UserInterface', 'searchEnterKeyDownEventListener');

        let target = e.target;
        if (target.id == 'awesompleteId') {
            let key = e.which || e.keyCode;
            if (key === 13) {
                // 13 is enter
                this.callSearchFromEnterKeyPressed = true;
            }
        }
    }

    searchEnterKeyUpEventListener(e) {
        testThis(this, 'N2UserInterface', 'searchEnterKeyUpEventListener');

        let target = e.target;
        if (target.id == 'awesompleteId') {
            let key = e.which || e.keyCode;
            if (key == 13) {
                // 13 is enter
                if (this.callSearchFromEnterKeyPressed) {
                    this.searchButtonClicked();
                }
            }
        }
    }
}
