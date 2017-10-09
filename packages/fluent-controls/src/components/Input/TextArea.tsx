import * as React from 'react';
import * as classNames from 'classnames/bind';
import {DivProps, SpanProps, PreProps, TextAreaProps, Elements as Attr} from '../../Attributes';
import {MethodNode} from '../../Common';
const css = classNames.bind(require('./TextArea.scss'));

export interface TextAreaType {}

export interface TextAreaAttributes {
    container?: DivProps;
    textarea?: TextAreaProps;
    pre?: PreProps;
}

export interface TextAreaProps extends React.Props<TextAreaType> {
    /** HTML form element name */
    name: string;
    /** Current value of HTML input element */
    value?: string;
    /** Text area placeholder */
    placeholder?: string;
    
    /** Apply error styling to input element */
    error?: boolean;
    /** Disable HTML input element and apply disabled styling */
    disabled?: boolean;
    /** Grow text area to fit user text */
    autogrow?: boolean;
    /** Autofocus */
    autoFocus?: boolean;

    /** Callback for HTML input element `onChange` events */
    onChange: (newValue: string) => void;

    /** Class to append to top level element */
    className?: string;

    attr?: TextAreaAttributes;
}

export interface TextAreaState {
}

/**
 * Low level text input control
 * 
 * (Use the `TextField` control instead when making a form with standard styling)
 */
export class TextArea extends React.Component<TextAreaProps, TextAreaState> {
    static defaultProps = {
        autogrow: true,
        error: false,
        disabled: false,
        value: '',
        attr: {
            container: {},
            textarea: {},
            pre: {}
        }
    };

    private textarea: HTMLTextAreaElement;
    private ghost: HTMLPreElement;

    constructor(props: TextAreaProps) {
        super(props);
    }

    componentDidUpdate(prevProps: TextAreaProps, prevState: TextAreaState) {
        const height = this.ghost.offsetHeight;
        if (this.props.autogrow && prevProps.value !== this.props.value && height > 52) {
            this.textarea.style.height = `${height}px`;
        }
    }

    render() {
        const value = this.props.value;

        return (
            <Attr.div
                className={css('textarea-container', this.props.className)}
                attr={this.props.attr.container}
            >
                <Attr.textarea
                    name={this.props.name}
                    value={value}
                    className={css('textarea', {'error': this.props.error})}
                    onChange={event => this.props.onChange(event.target.value)}
                    disabled={this.props.disabled}
                    placeholder={this.props.placeholder}
                    ref={element => this.textarea = element}
                    autoFocus={this.props.autoFocus}
                    attr={this.props.attr.textarea}
                />
                {this.props.autogrow ? 
                    <Attr.pre
                        className={css('textarea', 'textarea-ghost')}
                        ref={element => this.ghost = element}
                        attr={this.props.attr.pre}
                    >
                        {value + (value[value.length - 1] === '\n' ? '\n' : '')}
                    </Attr.pre> 
                : ''}
            </Attr.div>
        );
    }
}

export default TextArea;
