import * as React from 'react';
import * as classNames from 'classnames/bind';
import {DivProps, SpanProps, InputProps, Elements as Attr} from '../../Attributes';
import {Calendar, CalendarAttributes} from './Calendar';
import {Icon, IconSize, IconAttributes} from '../Icon';
import {replaceAt, formatDate, placeholders} from './helpers';
import {keyCode, MethodDate, dateIsValid, DateFormat} from '../../Common';
const css = classNames.bind(require('./DatePicker.scss'));

export interface DatePickerType {}

export interface DatePickerAttributes {
    container: DivProps;
    inputContainer: DivProps;
    input: InputProps;
    inputIcon: IconAttributes;
    dropdownContainer: DivProps;
    dropdownTriangle: DivProps;
    calendar: CalendarAttributes;
}

export interface DatePickerProps extends React.Props<DatePickerType> {
    /** HTML form element name */
    name: string;
    /**
     * Initial value of date picker
     * 
     * The onChange callback API does not receives invalid Date UTC ISO strings
     * so we can only provide an initialValue to the DatePicker
     */
    initialValue?: Date | string;

    /** Tab index for calendar control */
    tabIndex?: number;
    /** Apply error styling to input element */
    error?: boolean;
    /** Disable HTML input element and apply disabled styling */
    disabled?: boolean;
    /**
     * Display the date in local timezone instead of GMT
     *
     * Default: true
     */
    localTimezone?: boolean;
    /**
     * Show Calendar below date picker input
     */
    showAbove?: boolean;

    /** Date format in text input */
    format?: DateFormat;

    /**
     * Callback for HTML input element `onChange` events
     * 
     * When the user enters a valid date, onChange receives a UTC ISO string.
     * 
     * When the string value in the text input is not a valid date, onChange
     * receives the string "invalid"
     */
    onChange: (newValue: string) => void;
    /**
     * Callback for paste events
     * 
     * When the user pastes a valid date, onPaste receives a UTC ISO string.
     */
    onPaste?: (newValue: string) => void;

    /** Class to append to top level element */
    className?: string;

    attr?: DatePickerAttributes;
}

export interface DatePickerState {
    value: string;
    dateValue?: MethodDate;
    initialValue?: MethodDate;

    visible?: boolean;
    invalid?: boolean;
    error?: boolean;
}

/**
 * Low level date picker control
 *
 * (Use the `DateField` control instead when making a form with standard styling)
 */
export class DatePicker extends React.Component<DatePickerProps, DatePickerState> {
    static defaultProps = {
        format: DateFormat.MMDDYYYY,
        tabIndex: -1,
        localTimezone: true,
        showAbove: false,
        attr: {
            container: {},
            inputContainer: {},
            input: {},
            inputIcon: {},
            dropdownContainer: {},
            dropdownTriangle: {},
            calendar: {},
        }
    };

    private containerElement: HTMLDivElement;    
    private inputElement?: HTMLInputElement;
    private paste: boolean | string;
    private calendar: Calendar;

    oldSetState: any;

    constructor(props: DatePickerProps) {
        super(props);

        const newState = this.getInitialState(props);
        this.state = {
            ...newState,
            visible: false,
            error: newState.invalid
        };

        this.inputElement = null;
        this.paste = false;

        this.inputRef = this.inputRef.bind(this);
        this.calendarRef = this.calendarRef.bind(this);
        this.containerRef = this.containerRef.bind(this);
    }

    /**
     * Use props.initialValue to generate a new state
     * 
     * props.initialValue is used to set the hours/minutes/seconds on internal Date
     * 
     * @param props DatePickerProps
     */
    getInitialState(props: DatePickerProps): DatePickerState {
        const local = props.localTimezone;
        let value = '';
        let invalid = false;
        let initialValue: MethodDate = null;
        let dateValue: MethodDate = null;
        if (props.initialValue) {
            if (typeof(props.initialValue) === 'string') {
                const date = MethodDate.fromString(local, props.initialValue);
                if (date && dateIsValid(date.dateObject, local)) {
                    initialValue = date;
                    dateValue = date;
                    value = formatDate(date.dateObject, props.format, local);
                } else {
                    value = props.initialValue;
                    invalid = true;
                }
            } else {
                if (props.initialValue) {
                    value = formatDate(
                        props.initialValue,
                        props.format,
                        local
                    );
                    if (!dateIsValid(props.initialValue, local)) {
                        invalid = true;
                    } else {
                        initialValue = MethodDate.fromDate(local, props.initialValue);
                        dateValue = initialValue;
                    }
                } else {
                    initialValue = new MethodDate(local);
                    invalid = true;
                }
            }
        }
        
        if (!initialValue || initialValue.dateObject.toUTCString() === 'Invalid Date') {
            const today = new MethodDate(local);
            initialValue = today;
            dateValue = null;
        }
        
        return {
            value: value,
            invalid: invalid,
            initialValue: initialValue,
            dateValue: dateValue,
        };
    }

    /**
     * Update the Date/Time object used internally with a new initialValue
     * 
     * @param newProps new DatePickerProps
     */
    componentWillReceiveProps(newProps: DatePickerProps) {
        if (this.props.initialValue !== newProps.initialValue) {
            const newState = this.getInitialState(newProps);
            this.setState({
                ...newState,
                visible: this.state.visible,
                error: newState.invalid
            });
        }
    }

    /**
     * Register event handlers on click and focusin for window
     * 
     * Used to handle visibility of calendar dropdown
     */
    componentDidMount() {
        window.addEventListener('click', this.handleDropdown.bind(this));
        window.addEventListener('focusin', this.handleDropdown.bind(this));
    }

    /**
     * Clean up event handlers used to handle visibility of calendar dropdown
     */
    componentWillUnmount() {
        window.removeEventListener('click', this.handleDropdown);
        window.removeEventListener('focusin', this.handleDropdown);
    }

    /**
     * Fire props.onChange handler when state.value changes
     * 
     * Fires props.onChange('invalid') if input is invalid
     */
    componentDidUpdate(oldProps: DatePickerProps, oldState: DatePickerState) {
        if (oldState.value !== this.state.value || this.paste) {
            /**
             * onInput()/onSelect() update state.dateValue with a valid Date
             * Object whenever state.value is a valid Date. If state.dateValue
             * is null, then state.value is invalid
             */
            if (this.state.dateValue) {
                if (typeof(this.paste) === 'string' && this.props.onPaste) {
                    this.props.onPaste(this.paste);
                } else {
                    this.props.onChange(this.state.dateValue.dateObject.toUTCString());
                }
                this.paste = false;
            } else {
                this.props.onChange('invalid');
            }
        }
        if (this.state.visible !== oldState.visible && !this.state.visible) {
            this.calendar.stopAccessibility();
        }
    }

    /**
     * Handles string formatting and input behavior when the user is typing
     * in a month (the user must be appending to the string value)
     * 
     * Argument position is 1 for the Date format is MM/DD/YYYY, 
     * 2 for DD/MM/YYYY, and 2 for YYYY\MM\DD (used to append whack symbol)
     * 
     * @param newValue New value of the input element
     * @param position Position of month in date format
     */
    handleMonth(newValue: string, position: number) {
        const lastNum = parseInt(newValue[newValue.length - 1]);
        const suffix = (position < 3 ? '/' : '');
        /** If this is the first number in a two digit month... */
        if (newValue.length === 1 || newValue[newValue.length - 2] === '/') {
            if (lastNum > 1) {
                /**
                 * If the last digit of newValue is greater than 1, prepend
                 * zero to it (ie, 2 => 02, 9 => 09, etc.)
                 */
                if (position > 1) {
                    newValue = replaceAt(newValue, newValue.length - 1, '0');
                } else {
                    newValue = '0' + lastNum.toString();
                }
                newValue += suffix;
            }
        } else {
            /** First number in month (0 in 02, 1 in 12) */
            const otherLastNum = parseInt(newValue[newValue.length - 2]);
            if (otherLastNum < 1) {
                newValue += suffix;
            } else {
                if (lastNum < 3) {
                    newValue += suffix;
                } else {
                    /** Don't allow the user to type in an invalid month */
                    newValue = this.state.value;
                }
            }
        }
        return newValue;
    }

    /**
     * Handles string formatting and input behavior when the user is typing
     * in a date (the user must be appending to the string value)
     * 
     * Argument position is 1 for the Date format is DD/MM/YYYY, 
     * 2 for MM/DD/YYYY, and 3 for YYYY\MM\DD (used to append whack symbol)
     * 
     * @param newValue New value of the input element
     * @param position Position of month in date format
     */
    handleDay(newValue, position) {
        const lastNum = parseInt(newValue[newValue.length - 1]);
        const suffix = (position < 3 ? '/' : '');
        /** If this is the first number in a two digit date... */
        if (newValue.length === 1 || newValue[newValue.length - 2] === '/') {
            if (lastNum > 3) {
                /**
                 * If the last digit of newValue is greater than 3, prepend
                 * zero to it (ie, 4 => 04, 9 => 09, etc.)
                 */
                if (position > 1) {
                    newValue = replaceAt(newValue, newValue.length - 1, '0');
                } else {
                    newValue = '0' + lastNum.toString();
                }
                newValue += suffix;
            }
        } else {
            /** First number in date (0 in 02, 2 in 25) */
            const otherLastNum = parseInt(newValue[newValue.length - 2]);
            if (otherLastNum < 3) {
                newValue += suffix;
            } else {
                if (lastNum < 2) {
                    newValue += suffix;
                } else {
                    /**
                     * Don't allow the user to type in an invalid date
                     * 
                     * NOTE: This code DOES NOT check date with the month so
                     * here, day 30 in February is considered valid.
                     */
                    newValue = this.state.value;
                }
            }
        }
        return newValue;
    }

    /**
     * Handles string formatting and input behavior when the user is appending
     * to the input value
     * 
     * @param newValue New value of the input element
     */
    handleTyping(newValue: string) {
        if (this.props.format === DateFormat.YYYYMMDD) {
            if (newValue.length === 4) {
                newValue += '/';
            } else if (newValue.length === 6) {
                newValue = this.handleMonth(newValue, 2);
            } else if (newValue.length === 7) {
                newValue = this.handleMonth(newValue, 2);
            } else if (newValue.length === 9) {
                newValue = this.handleDay(newValue, 3);
            } else if (newValue.length > 10) {
                newValue = newValue.slice(0, 10);
            }
        }
        else if (this.props.format === DateFormat.MMDDYYYY) {
            if (newValue.length === 1) {
                newValue = this.handleMonth(newValue, 1);
            } else if (newValue.length === 2) {
                newValue = this.handleMonth(newValue, 1);
            } else if (newValue.length === 4) {
                newValue = this.handleDay(newValue, 2);
            } else if (newValue.length === 5) {
                newValue = this.handleDay(newValue, 2);
            } else if (newValue.length > 10) {
                newValue = newValue.slice(0, 10);
            }
        }
        else if (this.props.format === DateFormat.DDMMYYYY) {
            if (newValue.length === 1) {
                newValue = this.handleDay(newValue, 1);
            } else if (newValue.length === 2) {
                newValue = this.handleDay(newValue, 1);
            } else if (newValue.length === 4) {
                newValue = this.handleMonth(newValue, 2);
            } else if (newValue.length === 5) {
                newValue = this.handleMonth(newValue, 2);
            } else if (newValue.length > 10) {
                newValue = newValue.slice(0, 10);
            }
        }
        return newValue;
    }

    /**
     * Handles string formatting and input behavior when the user is using
     * backspace to delete from the end of the input value
     * 
     * @param newValue New value of the input element
     */
    handleDeletion(newValue: string) {
        if (this.state.value[this.state.value.length - 1] === '/') {
            return newValue.substr(0, newValue.length - 1);
        }
        return newValue;
    }

    parse(newValue: string) {
        let valid = true;

        let split = newValue.split('/');
        if (split.length !== 3) {
            valid = false;
            while (split.length < 3) {
                split.push('-1');
            }
        }

        let year, month, date;
        if (this.props.format === DateFormat.DDMMYYYY) {
            year = parseInt(split[2]);
            month = parseInt(split[1]);
            date = parseInt(split[0]);
        }
        else if (this.props.format === DateFormat.MMDDYYYY) {
            year = parseInt(split[2]);
            month = parseInt(split[0]);
            date = parseInt(split[1]);
        }
        else if (this.props.format === DateFormat.YYYYMMDD) {
            year = parseInt(split[0]);
            month = parseInt(split[1]);
            date = parseInt(split[2]);
        }

        if (isNaN(year) || year < 1) {
            valid = false;
        }
        if (isNaN(month) || month < 1 || month > 12) {
            valid = false;
        }
        if (isNaN(date) || date < 1 || date > 31) {
            valid = false;
        }

        if (valid) {
            const hasVal = !!this.state.initialValue;
            let parsed = new MethodDate(
                this.props.localTimezone,
                year, month - 1, date,
                hasVal ? this.state.initialValue.hours : 0,
                hasVal ? this.state.initialValue.minutes : 0,
                hasVal ? this.state.initialValue.seconds : 0,
            );
            if (month !== parsed.month + 1 || date !== parsed.date) {
                valid = false;
            }
        }
        return { year: year, month: month, date: date, valid: valid };
    }

    onInput(event) {
        let newValue: string = event.target.value;
        let invalid = this.state.invalid;
        let initialValue = this.state.initialValue;
        let dateValue = this.state.dateValue;
        if (this.paste) {
            const date = MethodDate.fromString(this.props.localTimezone, newValue);
            if (date) {
                invalid = false;
                newValue = formatDate(date.dateObject, this.props.format, this.props.localTimezone);
                initialValue = date;
                dateValue = date.copy();
                this.paste = date.dateObject.toUTCString();
            } else {
                invalid = true;
                dateValue = null;
                this.paste = null;
            }
        } else if (this.state.value.length >= newValue.length) {
            /** If the user starts deleting, stop smart input handling */
            if (this.state.value.length - newValue.length === 1) {
                let oldValue = this.state.value[this.state.value.length - 1];
                if (this.state.value.length > 0) {
                    if (newValue[newValue.length - 1] !== oldValue) {
                        newValue = this.handleDeletion(newValue);
                        if (newValue.length <= 10) {
                            invalid = this.parse(newValue).valid ? false : true;
                        } else {
                            invalid = true;
                        }
                    } else {
                        invalid = true;
                    }
                }
            } else {
                if (newValue.length === 0) {
                    invalid = true;
                }
            }
        } else if (this.state.value.length < newValue.length) {
            /** If the user is adding to newValue */
            if (newValue.length <= 10) {
                let oldSlice = this.state.value.substr(
                    0, this.state.value.length - 1
                );
                let newSlice = newValue.substr(0, newValue.length - 2);
                if (newValue.length > 1 && newSlice !== oldSlice) {
                    /**
                     * If the user types in the middle of the date, stop smart
                     * input handling
                     */
                    invalid = true;
                } else {
                    /**
                     * If the current value isn't invalid, handle the user
                     * typing (handleTyping handles formatting as you type)
                     */
                    if (!invalid) {
                        newValue = this.handleTyping(newValue);
                    }
                }
            } else {
                /**
                 * If the current value isn't invalid, prevent the user from
                 * typing more than 10 characters into the input
                 *
                 * (Do NOT do this if the user pastes in an invalid value)
                 */
                if (!invalid) {
                    newValue = this.state.value;
                }
            }
        }

        if (newValue.length === 0) {
            invalid = false;
        }

        let error = this.state.error;
        if (newValue.length > 11) {
            const date = MethodDate.fromString(this.props.localTimezone, newValue);
            if (date) {
                invalid = false;
                newValue = formatDate(date.dateObject, this.props.format, this.props.localTimezone);
                initialValue = date;
                dateValue = date;
            } else {
                dateValue = null;
                invalid = true;
            }
        } else {
            let result = this.parse(newValue);
            if (result.valid) {
                const isLocal = !!this.props.localTimezone;
                invalid = false;
                error = false;
                dateValue = new MethodDate(
                    this.props.localTimezone,
                    result.year, 
                    result.month - 1,
                    result.date,
                    initialValue.hours,
                    initialValue.minutes,
                    initialValue.seconds
                );
                /**
                 * Using the MethodDate/Date constructor forces years to be 
                 * at least 100 but we have to support any year > 0
                 */
                if (result.year < 100) {
                    if (this.props.localTimezone) {
                        dateValue.dateObject.setFullYear(result.year, result.month - 1, result.date);
                    } else {
                        dateValue.dateObject.setUTCFullYear(result.year, result.month - 1, result.date);
                    }
                }
            } else {
                error = true;
                dateValue = null;
            }
        }
        this.setState({
            value: newValue,
            invalid: invalid,
            error: invalid,
            dateValue: dateValue,
            initialValue: initialValue
        });
    }

    /**
     * Whenever focus changes or user clicks something, decide if the
     * calendar should stay open or close
     *
     * This handler needs to be added to the 'focus' and 'click' events for
     * the whole window
     *
     * @param event Focus or Click event
     */
    handleDropdown(event) {
        if (event.target === this.inputElement) {
            return;
        }
        if (!this.state.visible) {
            return;
        }

        let className = css('dropdown');
        let target = event.target;
        /**
         * Go back several levels to check whether the user is clicking in the
         * calendar (which causes the text input to lose focus)
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
            this.setState({ visible: false });
        }
    }

    onFocus() {
        this.setState({visible: true});
    }

    onSelect(newValue: Date) {
        this.setState({
            value: formatDate(newValue, this.props.format, this.props.localTimezone),
            error: false,
            visible: false,
            dateValue: MethodDate.fromDate(this.props.localTimezone, newValue)
        });
    }

    onKeyPress(event) {
        if (this.state.value.length < 10) {
            if (event.charCode >= keyCode['0'] && event.charCode <= keyCode['9']) {
                return;
            }
    
            if (event.charCode === keyCode.slash) {
                if (this.state.value.split('/').length < 3) {
                    return;
                }
            }

            event.preventDefault();
        }
    }

    onKeyUp(event) {
        if (event.keyCode === keyCode.enter) {
            this.calendar.startAccessibility();
            event.preventDefault();
        }
    }

    onPaste(event) {
        this.paste = true;
    }

    inputRef(element: HTMLInputElement) {
        this.inputElement = element;
    }

    calendarRef(element: Calendar) {
        this.calendar = element;
    }

    containerRef(container: HTMLDivElement) {
        this.containerElement = container;
    }

    render() {
        const containerClassName = css('date-picker-container', this.props.className);
        const inputClassName = css('input', {'error': this.state.error || this.props.error});
        const dropdownClassName = css('dropdown', {
            'visible': this.state.visible,
            'above': this.props.showAbove
        });

        const icon = <Icon
            icon='calendar'
            size={IconSize.xsmall}
            className={css('calendar-icon')}
            attr={this.props.attr.inputIcon}
        />;

        const placeholder = placeholders[this.props.format];

        const parsed = this.parse(this.state.value);

        return (
            <Attr.div
                className={containerClassName}
                ref={this.containerRef}
                attr={this.props.attr.container}
            >
                <Attr.div
                    className={css('input-container')}
                    attr={this.props.attr.inputContainer}
                >
                    <Attr.input
                        type='text'
                        name={this.props.name}
                        value={this.state.value}
                        className={inputClassName}
                        placeholder={placeholder}
                        onFocus={event => this.onFocus()}
                        onInput={event => this.onInput(event)}
                        onPaste={event => this.onPaste(event)}
                        onKeyUp={event => this.onKeyUp(event)}
                        onKeyPress={event => this.onKeyPress(event)}
                        /** React warns about Input without onChange handler */
                        onChange={() => {}}
                        /**
                         * This is not the same as props.required
                         * (this gives us :valid css selector)
                         */
                        required
                        disabled={this.props.disabled}
                        ref={this.inputRef}
                        attr={this.props.attr.input}
                    />
                    {icon}
                </Attr.div>
                <Attr.div
                    className={dropdownClassName}
                    attr={this.props.attr.dropdownContainer}
                >
                    <Calendar
                        value={
                            this.state.dateValue
                                ? this.state.dateValue.toDate()
                                : null
                        }
                        onChange={newValue => this.onSelect(newValue)}
                        className={css('calendar')}
                        year={parsed.year || null}
                        month={parsed.month - 1 || null}
                        tabIndex={this.props.tabIndex}
                        ref={this.calendarRef}
                        attr={this.props.attr.calendar}
                    />
                    <Attr.div
                        className={css('dropdown-triangle')} 
                        attr={this.props.attr.dropdownTriangle}
                    />
                </Attr.div>
            </Attr.div>
        );
    }
}

export default DatePicker;
