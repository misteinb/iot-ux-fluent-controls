import * as React from 'react';
import * as classNames from 'classnames/bind';
import {DivProps, ButtonProps, SpanProps, InputProps, Elements as Attr} from '../../Attributes';
import {Icon, IconSize} from '../Icon';
import {MethodNode, FormOption, keyCode, hasClassName} from '../../Common';
const css = classNames.bind(require('./ComboInput.scss'));

export interface ComboInputType {}

export interface ComboInputAttributes {
    container?: DivProps;
    textbox?: DivProps;
    input?: InputProps;
    clearButton?: ButtonProps;
    chevron?: SpanProps;
    dropdown?: DivProps;
    option?: ButtonProps;
}

export interface ComboInputProps extends React.Props<ComboInputType> {
    /** HTML form element name */
    name: string;
    /** Current value of HTML input element */
    value: string | any;
    /** HTML input element placeholder */
    placeholder?: string;

    /** 
     * List of HTML select element options in the format:
     * 
     * `{
     *     label: string,
     *     value: any,
     *     disabled: boolean,
     *     hidden: boolean
     * }`
     */
    options: FormOption[];

    /**
     * Callback used to map FormOption to strings to be used by default 
     * optionFilter and optionSelect callbacks
     * 
     * See examples for how to use these callbacks
     */
    optionMap?: (option: FormOption) => string;
    /**
     * Callback used to filter list of FormOptions for display in the dropdown
     * 
     * This function can, for example, implement autocomplete by hiding
     * any option that does not contain the value in the text input
     * 
     * See examples for how to use these callbacks
     */
    optionFilter?: (newValue: string, option: FormOption) => boolean;
    /**
     * Callback used to decide whether a FormOption is selected or not
     * 
     * See examples for how to use these callbacks
     */
    optionSelect?: (newValue: string, option: FormOption) => boolean;
    /**
     * Callback used to generate a React node to use as the label in dropdown
     * 
     * This function can, for example, bold any relevant fragments of text for
     * highlighting in autocomplete
     * 
     * See examples for how to use these callbacks
     */
    optionLabel?: (newValue: string, option: FormOption) => MethodNode;

    /** Apply error styling to input element */
    error?: boolean;
    /** Disable HTML input element and apply disabled styling */
    disabled?: boolean;
    /** Autofocus */
    autoFocus?: boolean;
    /**
     * Show label instead of FormOption value in ComboInput text box when a 
     * value from the FormOptions is selected
     * 
     * Since the ComboInput has a text input, it cannot draw an arbitrary 
     * MethodNode as the textbox value. If props.optionLabel returns a string,
     * then you can show the label text in the textbox instead of the option
     * value itself.
     * 
     * Note: If the label and value are different and showLabel is true,
     * when the user starts typing after making a selection in the dropdown,
     * it will not reselect the option unless optionSelect checks the label
     * string as well as the value.
     * 
     * For example:
     * ```js
     * optionSelect = (newValue, option) => {
     *     return newValue === option.value || newValue === option.label.toString();
     * }
     * ```
     * 
     * Default: true
     */
    showLabel?: boolean;

    /** Callback for HTML input element `onChange` events */
    onChange: (newValue: string | FormOption) => void;

    /** Class to append to top level element */
    className?: string;
    /** Class to append to HTML Input element */
    inputClassName?: string;
    /** Class to append to top level dropdown element */
    dropdownClassName?: string;

    attr?: ComboInputAttributes;
}

export interface ComboInputState {
    visible: boolean;
    hovered: FormOption;
}

const defaultMap = (option: FormOption) => {
    if (typeof(option.value) === 'string') {
        return option.value;
    }
    console.error('METHOD ERROR: The default ComboInput map function expects FormOption.value to be a string');
    return '';
};

const defaultFilter = (newValue: string, option: FormOption) => !option.hidden;

const defaultSelect = (newValue: string, option: string) => option === newValue;

const defaultLabel = (newValue: string, option: FormOption) => option.label;

/**
 * Low level combo input control
 * 
 * `ComboInput` is a hybrid of the SelectInput and TextInput controls. It
 * functions as a 'new or existing' text field where the user can type in a
 * custom value or pick from a list of values provided by the control.
 * 
 * `ComboInput` consumes the property `options: FormOption[]` which specify
 * each option's `value` and `label`. The former can be any object while the
 * latter can be any React node (or a string). `ComboInput` also consumes a
 * `value: string | FormOption` property that sets the current value of the
 * `ComboInput` text field. If `value` is a `string`, the user is typing in a
 * custom value and if it is an object, the user has either typed in a value
 * equal to one of the options or has selected an option from the dropdown list.
 * 
 * In this example of a default `ComboInput`, `FormOption.value` must be a
 * string, which allows you to use `ComboInput` with only the properties `name`,
 * `value`, `onChange`, and `options`. When the user types in 'Option 1', that
 * option will be considered selected instead of a custom object.
 * 
 * *Reffer to the other examples on how to use `ComboInput`'s callbacks to
 * further modify what options display in the dropdown.*
 * 
 * (Use the `ComboField` control for forms with standard styling)
 */
export class ComboInput extends React.Component<ComboInputProps, ComboInputState> {
    static defaultProps =  {
        optionMap: defaultMap,
        optionLabel: defaultLabel,
        showLabel: true,
        attr: {
            container: {},
            textbox: {},
            input: {},
            clearButton: {},
            chevron: {},
            dropdown: {},
            option: {},
        }
    };

    inputElement: HTMLInputElement;
    containerElement: HTMLDivElement;
    optionFilter: (newValue: string, option: FormOption) => boolean;
    optionSelect: (newValue: string, option: FormOption) => boolean;

    constructor(props: ComboInputProps) {
        super(props);
        
        this.state = {
            visible: false,
            hovered: null
        };
        
        const map = props.optionMap;
        this.inputElement = null;
        this.optionFilter = !!props.optionFilter ? props.optionFilter 
            : defaultFilter;
        this.optionSelect = !!props.optionSelect ? props.optionSelect
            : (newValue, option) => defaultSelect(newValue, map(option));

        this.containerRef = this.containerRef.bind(this);
    }

    containerRef(container: HTMLDivElement) {
        this.containerElement = container;
    }

    componentDidMount() {
        window.addEventListener('click', this.handleDropdown.bind(this));
    }

    componentWillUnmount() {
        window.removeEventListener('click', this.handleDropdown);
    }

    handleDropdown(event) {
        if (event.target === this.inputElement) {
            return;
        }
        if (!this.state.visible && !hasClassName(event.target, css('cancel'))) {
            return;
        }

        const className = css('combo-input-container');
        let target = event.target;
        /**
         * Go back several levels to check whether the user is clicking in the
         * dropdown (which causes the text input to lose focus)
        */
        for (let i = 0; i < 6; i++) {
            if (target === this.containerElement) {
                break;
            }

            if (target.parentElement) {
                target = i < 5 ? target.parentElement : null;
                continue;
            } else {
                target = null;
                break;
            }
        }

        if (!target) {
            this.hideDropdown();
        } else {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    onFocus(event) {
        this.showDropdown();
    }

    getDropdownIndex(options: FormOption[]): number {
        if (this.state.hovered) {
            return options.indexOf(this.state.hovered);
        }
        if (!this.props.value) {
            return -1;
        }
        return options.map(option => option.value).indexOf(this.props.value);
    }

    getNextIndex(options: FormOption[], index, increment: number = 1): number {
        let option;
        let curIndex = index;

        if (!(increment > 0 || increment < 0)) {
            return index;
        }

        if (index < 0) {
            curIndex = increment < 0 ? options.length : -1;
        }

        do {
            curIndex += increment;
            if (index === curIndex) {
                return index;
            } else if (curIndex >= options.length && increment > 0) {
                curIndex = 0;
            } else if (curIndex <= -1 && increment < 0) {
                curIndex = options.length - 1;
            }
            option = options[curIndex];
        } while (option.disabled || option.hidden);

        return curIndex;
    }

    onKeyDown(event) {
        
        let index, options;
        const setState = index => this.setState({
            visible: true,
            hovered: options[index]
        });

        switch (event.keyCode) {
            case keyCode.down:
                options = this.getVisibleOptions();
                index = this.getNextIndex(options, this.getDropdownIndex(options), 1);
                this.setState({hovered: options[index], visible: true});
                break;
            case keyCode.up:
                options = this.getVisibleOptions();
                index = this.getNextIndex(options, this.getDropdownIndex(options), -1);                
                this.setState({hovered: options[index], visible: true});
                break;
            case keyCode.enter:
                if (this.state.visible) {
                    this.props.onChange(this.state.hovered.value);
                    this.hideDropdown();
                } else {
                    this.showDropdown();
                }
                break;
            default:
                this.setState({visible: true});
                return;
        }
        event.preventDefault();
    }

    getValue(): string {
        if (typeof(this.props.value) === 'string') {
            return this.props.value;
        } else {
            let result = null;
            this.props.options.forEach(option => {
                if (option.value === this.props.value) {
                    result = option;
                }
            });

            if (result) {
                return this.props.optionMap(result);
            }
        }
        return '';
    }

    getVisibleOptions(getDisabled: boolean = true): FormOption[] {
        let filter = option => !option.hidden;
        if (typeof(this.props.value) === 'string') {
            filter = option => {
                return this.optionFilter(
                    this.getValue(),
                    option
                );
            };
        }
        const results = this.props.options.filter(filter);
        return getDisabled ? results : results.filter(option => !option.disabled);
    }

    onInputChange(event) {
        const newValue = event.target.value;
        const options = this.getVisibleOptions();
        const result = options.filter(option => this.optionSelect(newValue, option));
        if (result.length > 0) {
            this.props.onChange(result[0].value);
        } else {
            this.props.onChange(newValue);
        }
    }

    showDropdown() {
        this.setState({visible: true});
    }

    hideDropdown() {
        this.setState({visible: false, hovered: null});
    }

    render () {
        const containerClassName = css('combo-input-container', this.props.className);
        const inputClassName = css({
            'input': true,
            'error': this.props.error,
            'visible': this.state.visible
        }, this.props.inputClassName);
        const dropdownClassName = css(
            'dropdown', {
                'visible': this.state.visible
            }, this.props.dropdownClassName
        );

        let inputValue = '';
        const value = this.getValue();
        let result = null;
        const options = this.getVisibleOptions().map((option, index) => {
            const checkLabel = this.props.showLabel
                ? this.props.optionLabel(value, option).toString === this.props.value
                : false;
            if (option.value === this.props.value || checkLabel) {
                result = option;
            }

            const optionClassName = css('option', {
                'selected': this.optionSelect(value, option),
                'hover': this.state.hovered === option,
                'disabled': option.disabled
            });
            const onClick = option.disabled ? () => {} : (event) => {
                this.props.onChange(option.value);
                this.hideDropdown();
                this.inputElement.blur();
            };
            const onHover = (event) => {
                this.setState({hovered: option});
            };

            return (
                <Attr.button
                    type='button'
                    className={optionClassName}
                    onClick={onClick}
                    onMouseOver={onHover}
                    tabIndex={-1}
                    key={index}
                    attr={this.props.attr.option}
                >
                    {this.props.optionLabel(value, option)}
                </Attr.button>
            );
        });

        if (result) {
            inputValue = this.props.showLabel 
                ? this.props.optionLabel(value, result).toString()
                : value;
        } else {
            if (typeof(this.props.value) === 'string') {
                inputValue = this.props.value;
            }
        }

        const clearButton = this.props.disabled ? '' :
            <Attr.button
                type='button'
                className={css('cancel', 'icon icon-cancel')}
                onClick={() => {
                    this.inputElement.focus();
                    this.props.onChange('');
                }}
                tabIndex={-1}
                attr={this.props.attr.clearButton}
            />;

        return (
            <Attr.div
                className={containerClassName}
                attr={this.props.attr.container}
                methodRef={this.containerRef}
            >
                <Attr.div
                    className={css('input-container')}
                    attr={this.props.attr.textbox}
                >
                    <Attr.input 
                        type='text'
                        name={this.props.name}
                        value={inputValue}
                        className={inputClassName}
                        onChange={event => this.onInputChange(event)}
                        placeholder={this.props.placeholder}
                        onFocus={event => this.onFocus(event)}
                        onKeyDown={event => this.onKeyDown(event)}
                        // This is not the same as this.props.required
                        // (this gives us :valid css selector)
                        required
                        disabled={this.props.disabled}
                        methodRef={(element) => this.inputElement = element}
                        autoFocus={this.props.autoFocus}
                        attr={this.props.attr.input}
                    />
                    {clearButton}
                    <Attr.span
                        className={css('chevron', 'icon icon-chevronDown')} 
                        attr={this.props.attr.chevron}
                    />
                    <Attr.div
                        className={dropdownClassName}
                        attr={this.props.attr.dropdown}
                    >
                        {options}
                    </Attr.div>
                </Attr.div>
            </Attr.div>
        );
    }
}

export default ComboInput;