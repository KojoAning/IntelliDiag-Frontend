import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const BottomSectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  margin-top: 10px;
  height: 16.75rem; /* 284px */
  align-items: flex-start;
`;

const SectionLabel = styled.div`
  background-color: rgba(6, 148, 251, 0.17);
  display: inline-flex;
  border-radius: 0.6875rem; /* 11px */
  padding: 0.375rem 0.5625rem; /* 6px 9px */
`;

const LabelText = styled.p`
  margin: 0;
  font-size: 0.8125rem; /* 13px */
  color: rgba(6, 148, 251, 1);
  font-weight: 500;
`;

const CardsContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  gap: 2.1875rem; /* 35px */
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: #333 transparent;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #333;
    border-radius: 3px;
  }
`;

const Card = styled.div`
  background-color: #0c0c0c;
  height: 100%;
  min-width: 14.625rem; /* 234px */
  border-radius: 1.125rem; /* 18px */
  flex-shrink: 0;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-4px);
  }

  @media (max-width: 768px) {
    min-width: 12rem;
  }

  @media (max-width: 480px) {
    min-width: 10rem;
  }
`;

const Bottomsection = ({ cardCount = 6 }) => {
  return (
    <BottomSectionContainer>
      <SectionLabel>
        <LabelText>Ai models</LabelText>
      </SectionLabel>

      <CardsContainer>
        {Array.from({ length: cardCount }).map((_, index) => (
          <Card key={index} />
        ))}
      </CardsContainer>
    </BottomSectionContainer>
  );
};

Bottomsection.propTypes = {
  cardCount: PropTypes.number,
};

export default Bottomsection;
