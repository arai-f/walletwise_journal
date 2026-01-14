
const Card = ({ children, className = "", ...props }) => {
    return (
        <div className={`block bg-white rounded-lg shadow-sm p-4 ${className}`} {...props}>
            {children}
        </div>
    );
};

export default Card;
