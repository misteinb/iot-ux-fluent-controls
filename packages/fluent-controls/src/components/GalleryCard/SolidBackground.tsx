import * as React from 'react';
import * as classNames from 'classnames/bind';
const css = classNames.bind(require('./GalleryCard.scss'));

export interface SolidBackgroundType {}

export interface SolidBackgroundProps extends React.Props<SolidBackgroundType> {
    /**
     * Background color (accepts string color names and RGB hex values)
     * 
     * Default: #eaeaea
     */
    backgroundColor?: string;
    
    /**
     * Fixed width and height (284 x ?? pixels)
     * 
     * Default: true
     */
    fixed?: boolean;
    
    /** Classname to append to top level element */
    className?: string;
}

/**
 * Solid color background for `GalleryCard`
 * 
 * Should usually be marked as `fixed`, otherwise it will have no dimensions
 * 
 * @param props Control properties (Defined in `ImageBackgroundProps` interface)
 */
export const SolidBackground: React.StatelessComponent<SolidBackgroundProps> = (props: SolidBackgroundProps) => {
    let bgColor = props.backgroundColor || '#eaeaea';

    let cls = css({
        'background-color': true,
        'fixed': !!props.fixed
    }, props.className);

    let style = {
        backgroundColor: bgColor
    };

    return (
        <div className={cls} style={style}>
            {props.children}            
        </div>
    );
};

SolidBackground.defaultProps = {
    backgroundColor: '#eaeaea',
    fixed: true
};

export default SolidBackground;