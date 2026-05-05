import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const GreetingContainer = styled.div`
  width: 100%;
  max-width: 32.8125rem; /* 493px */
  display: flex;
  flex-direction: column;
  gap: 0.5625rem; /* 9px */
  margin: 0;
  padding: 1rem;
  box-sizing: border-box;
`;

const DateText = styled.p`
  margin: 0;
  color: #ffffff;
  font-size: 0.875rem; /* 14px */
  line-height: 1.4;
  opacity: 0.8;
`;

const GreetingText = styled.h1`
  margin: 0;
  color: #ffffff;
  font-weight: 500;
  font-size: 2.5rem; /* 40px */
  line-height: 1.2;
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
  
  @media (max-width: 480px) {
    font-size: 1.75rem;
  }
`;

const HighlightName = styled.span`
  color: #0694fb;
  font-weight: 500;
`;

const Greeting = ({ date = "Mon, July 2", name = "Courtney", message = "how can we help you today?" }) => {
  return (
    <GreetingContainer>
      <DateText>{date}</DateText>
      <GreetingText>
        Hello, <HighlightName>{name}</HighlightName>
        <br />
        {message}
      </GreetingText>
    </GreetingContainer>
  );
};

Greeting.propTypes = {
  date: PropTypes.string,
  name: PropTypes.string,
  message: PropTypes.string,
};

export default Greeting;