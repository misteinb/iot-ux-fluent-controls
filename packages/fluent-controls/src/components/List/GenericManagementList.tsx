import { DEFAULT_ENCODING } from 'crypto';
import * as React from 'react';
import * as classNames from 'classnames/bind';
import {DivProps, ButtonProps, Elements as Attr} from '../../Attributes';
import {Icon, IconAttributes} from '../Icon';
import {MethodNode, GridColumn, SortDirection} from '../../Common';
import {CheckboxInput, CheckboxInputAttributes} from '../Input/CheckboxInput';
const css = classNames.bind(require('./GenericManagementList.scss'));

export interface GenericManagementListComponentType {}

export interface GenericManagementListAttributes {
    container?: DivProps;
    column?: DivProps;
    rowHeader?: ButtonProps;
    rowContent?: DivProps;
    rowHeaderChevron?: IconAttributes;
    selectAllContainer?: DivProps;
    selectAllEmptyContainer?: DivProps;
    selectAllCheckbox?: CheckboxInputAttributes;
    selectRowContainer?: DivProps;
    selectRowCheckbox?: CheckboxInputAttributes;
}

export interface GenericManagementListProps<T> extends React.Props<GenericManagementListComponentType> {
    /**
     * List of `GridColumn` objects that provide mappings from row type T to
     * column values and sorting 
     * 
     * See documentation for GridColumn<T> for more information
     */
    columns: Array<GridColumn<T>>;
    /**
     * List of row objects
     * 
     * This can be a list of anything that satisfies the GridColumn callbacks
     * provided in props.columns
     */
    rows: Array<T>;
    /**
     * HTML input element name prefix to use for checkboxes
     * 
     * default: management-list
     */
    name?: string;
    
    /**
     * Callback for checkbox value changes
     * 
     * If this callback is not provided, row selection checkboxes will not be shown
     */
    onSelect?: (row: T, newValue: boolean) => void;
    /**
     * Callback for select all checkbox value changes
     * 
     * If this callback is not provided, select all checkbox will not be shown
     */
    onSelectAll?: (allSelected: boolean) => void;
    /**
     * A key of row type `T` or callback that returns whether a row is selected.
     * 
     * If this is not provided, row selection checkboxes will not be shown
     */
    isSelected?: ((row: T) => boolean) | keyof T;
    
    /**
     * A key of row type `T` or callback that returns the label for the select checkbox
     * for accessibility.
     * 
     * If this is not provided, no label will be rendered.
     */
    selectLabel?: ((row: T) => MethodNode) | keyof T;
    /**
     * A label for the select all checkbox for accessibility
     */
    selectAllLabel?: MethodNode;
    
    /** 
     * Currently sorted column
     */
    sortedColumn?: GridColumn<T>;
    /**
     * Direction of current sort
     * 
     * 'ascending' | 'descending'
     * 
     * Default: 'ascending'
     */
    sortDirection?: SortDirection;

    /** Classname to append to top level element */
    className?: string;

    attr?: GenericManagementListAttributes;
}

/**
 * Generic Management List
 * 
 * To use this component in TSX:
 * 
 * ```ts
 * const Grid = CreateManagementList<Type>();
 * 
 * <Grid rows={Type[]} columns={GridColumn<Type>} />
 * ```
 * 
 * Unless you need type checking, you should use `ManagementList` instead.
 * 
 * @param props Control properties (defined in `GenericManagementListProps` interface)
 */
export class GenericManagementList<T> extends React.PureComponent<GenericManagementListProps<T>, {}> {
    static defaultProps = {
        name: 'management-list',
        selectAllLabel: 'Select All',
        selectLabel: () => '',
        defaultDirection: 'ascending',
        attr: {
            container: {},
            column: {},
            rowHeader: {},
            rowContent: {},
            rowHeaderChevron: {},
            selectAllContainer: {},
            selectAllEmptyContainer: {},
            selectAllCheckbox: {},
            selectRowContainer: {},
            selectRowCheckbox: {},
        }
    };

    render() {
        let columns = this.props.columns.map(col => []);
        this.props.columns.forEach((column, colIndex) => {
            let onClick: (event) => void = null;
            let labelSuffix: MethodNode = '';
            const sortable = column.onAscending && column.onDescending;
            if (sortable) {
                if (this.props.sortedColumn === column) {
                    let icon = '';
                    if (this.props.sortDirection === 'descending') {
                        icon = 'chevronDown';
                        onClick = event => column.onAscending();
                    } else {
                        icon = 'chevronUp';
                        onClick = event => column.onDescending();
                    }
                    labelSuffix = <Icon 
                        icon={icon}
                        fontSize={12}
                        className={css('sort-direction')}
                        attr={this.props.attr.rowHeaderChevron}
                    />;
                } else {
                    onClick = column.defaultDirection === 'descending'
                        ? event => column.onDescending()
                        : event => column.onAscending();
                }
            }
            columns[colIndex].push(
                <Attr.button
                    type='button'
                    className={css('column-header')}
                    key={`header-${colIndex}`}
                    onClick={onClick}
                    disabled={!sortable}
                    attr={this.props.attr.rowHeader}
                >
                    {column.label}{labelSuffix}
                </Attr.button>
            );
            columns[colIndex].push(
                this.props.rows.map((row, rowIndex) => {
                    let content: MethodNode = '';
                    if (column.mapColumn instanceof Function) {
                        content = column.mapColumn(row);
                    } else {
                        const colValue = row[column.mapColumn];
                        if (
                            typeof(colValue) === 'string' ||
                            colValue instanceof React.Component ||
                            colValue instanceof React.PureComponent
                        ) {
                            content = colValue;
                        } else {
                            console.error('Method Error: Management List Column property mapColumn must return a valid React Node');
                        }
                    }
                    return (
                        <Attr.div
                            className={css('column-content')}
                            key={rowIndex}
                            attr={this.props.attr.rowContent}
                        >
                            {content}
                        </Attr.div>
                    );
                }
            ));
        });

        if (this.props.onSelect && this.props.isSelected) {
            const selected = this.props.rows.map(row => 
                this.props.isSelected instanceof Function 
                    ? this.props.isSelected(row)
                    : row[this.props.isSelected]
            );
            const allSelected = selected.filter(row => row).length === selected.length;
            const checkboxCol = [];
            const selectAll = !this.props.onSelectAll
                ? <Attr.div
                    className={css('checkbox-empty')}
                    attr={this.props.attr.selectAllEmptyContainer}
                />
                : <CheckboxInput
                    name={`${this.props.name}-select-all`}
                    label={
                        <Attr.div className={css('select-all-label')}>
                            {this.props.selectAllLabel}
                        </Attr.div>
                    }
                    checked={allSelected}
                    onChange={newValue => this.props.onSelectAll(newValue)}
                    attr={this.props.attr.selectAllCheckbox}
                />;

            checkboxCol.push(
                <Attr.div
                    className={css('column-header', 'checkbox', {
                        'checkbox-empty': !this.props.onSelectAll
                    })}
                    key={'select-all'}
                    attr={this.props.attr.selectAllContainer}
                >
                    {selectAll}
                </Attr.div>
            );

            this.props.rows.forEach((row, index) => {
                let selectLabel: MethodNode;
                if (this.props.selectLabel instanceof Function) {
                    selectLabel = this.props.selectLabel(row);
                } else {
                    const colValue = row[this.props.selectLabel];
                    if (
                        typeof(colValue) === 'string' ||
                        colValue instanceof React.Component ||
                        colValue instanceof React.PureComponent
                    ) {
                        selectLabel = colValue;
                    } else {
                        console.error('Method Error: Management List Column property selectLabel must return a valid React Node');
                    }
                }
                checkboxCol.push(
                    <Attr.div
                        className={css('column-content', 'checkbox')}
                        key={`select-${index}`}
                        attr={this.props.attr.selectRowContainer}
                    >
                        <CheckboxInput
                            name={`${this.props.name}-select-${index}`}
                            label={
                                <Attr.div className={css('select-all-label')}>
                                    {selectLabel}
                                </Attr.div>
                            }
                            checked={
                                this.props.isSelected instanceof Function
                                    ? this.props.isSelected(row)
                                    : !!row[this.props.isSelected]
                            }
                            onChange={newValue => this.props.onSelect(row, newValue)}
                            attr={this.props.attr.selectRowCheckbox}
                        />
                    </Attr.div>
                );
            });
            columns = [checkboxCol, ...columns];
        }

        return (
            <Attr.div
                className={css('list-container')}
                attr={this.props.attr.container}
            >
                {columns.map((col, index) => (
                    <Attr.div
                        className={css('column', {
                            'checkbox': index === 0 
                                && this.props.isSelected && this.props.onSelect
                        })}
                        key={index}
                        attr={this.props.attr.column}
                    >
                        {col}
                    </Attr.div>
                ))}
            </Attr.div>
        );
    }
}

export default GenericManagementList;
