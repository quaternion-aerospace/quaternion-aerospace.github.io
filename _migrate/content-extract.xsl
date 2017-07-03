<xsl:stylesheet version="3.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions"
	xmlns:math="http://www.w3.org/2005/xpath-functions/math"
	xmlns:map="http://www.w3.org/2005/xpath-functions/map"
	xmlns:array="http://www.w3.org/2005/xpath-functions/array"
	xmlns:output="http://www.w3.org/2010/xslt-xquery-serialization"
	xmlns:err="http://www.w3.org/2005/xqt-errors"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:xd="http://max.terpstra.ca/ns/xsl-doc"
	exclude-result-prefixes="#all"
>

	<xsl:mode
		streamable="no"
		on-multiple-match="fail"
		on-no-match="shallow-copy"
		warning-on-no-match="no"
	/>

	<xsl:variable name="categories" as="map(*)" select="map{
		'7': 'Product',
		'8': 'Service',
		'9': 'Educational',
		'10': 'Company',
		'11': 'contact',
		'12': 'Homepage Slider'
	}"/>
	<xsl:variable name="menu" as="document-node()" select="doc('jos_menu.xml')"/>
	<xsl:variable name="content" as="document-node()" select="doc('jos_content.xml')"/>
	<xsl:variable name="articleRex" select="'^index.php\?option=com_content&amp;view=article&amp;id=\d+'"/>

	<xsl:variable name="attachedToMenu" as="xs:string+" select="
		$menu//column[@name='link'][matches(., $articleRex)]/substring-after(., '&amp;id=')
	"/>
	<xsl:variable name="unattached" select="
		$content//table[not(column[@name='id'] = $attachedToMenu)]
	"/>
	
	<xsl:key name="article" match="table[@name='jos_content']" use="string(column[@name='id'])"/>

	<xsl:template match="/">
		<xsl:for-each-group
			select="$menu//table[matches(column[@name='link'], $articleRex)]"
			group-by="column[@name='menutype']"
		>
			<xsl:variable name="subMenu" select="
				if (current-grouping-key() eq 'mainmenu') then ()
				else if (ends-with(current-grouping-key(), '-menu')) then
					substring-before(current-grouping-key(), '-menu')
				else ()
			"/>
			<xsl:variable name="dataHref" select="
				if ($subMenu) then concat('../_data/menus/', $subMenu, '.yml')
				else concat('../_data/menus/', current-grouping-key(), '.yml')
			"/>
			<xsl:result-document href="{$dataHref}" method="text">
				<xsl:for-each select="
					$menu//table
						[column[@name='menutype'] eq current-grouping-key()]
						[column[@name='level'] eq '1']
				">
					<xsl:variable name="article" select="
						key('article', substring-after(column[@name='link'], '&amp;id='), $content)
					"/>
					<xsl:variable name="id" select="string(column[@name='id'])"/>
					<xsl:variable name="children" select="
						$menu//table
							[column[@name='parent_id'] eq $id]
							[matches(column[@name='link'], $articleRex)]
					"/>
					<xsl:variable name="page" select="concat(
						column[@name='path'],
						if (exists($children)) then '/index'
						else ()
					)"/>
					<xsl:if test="exists($article)">
						<xsl:text>- label: </xsl:text>
							<xsl:value-of select="column[@name='title']"/>
							<xsl:text>&#x0a;</xsl:text>
						<xsl:text>  page: </xsl:text>
							<xsl:value-of select="$page"/>
							<xsl:text>.html</xsl:text>
							<xsl:text>&#x0a;</xsl:text>
							
						<xsl:apply-templates select="$article">
							<xsl:with-param name="path" select="$page"/>
							<xsl:with-param name="subMenu" select="$subMenu"/>
						</xsl:apply-templates>

						<xsl:if test="exists($children)">
							<xsl:text>  submenu:&#x0a;</xsl:text>
							<xsl:for-each select="$children">
								<xsl:variable name="article" select="key(
									'article',
									substring-after(column[@name='link'], '&amp;id='),
									$content
								)"/>
								<xsl:if test="exists($article)">
									<xsl:text>    - label: </xsl:text>
										<xsl:value-of select="column[@name='title']"/>
										<xsl:text>&#x0a;</xsl:text>
									<xsl:text>      page: </xsl:text>
										<xsl:value-of select="column[@name='path']"/>
										<xsl:text>.html</xsl:text>
										<xsl:text>&#x0a;</xsl:text>
										
									<xsl:apply-templates select="$article">
										<xsl:with-param name="path" select="column[@name='path']"/>
										<xsl:with-param name="subMenu" select="$subMenu"/>
									</xsl:apply-templates>									
								</xsl:if>
							</xsl:for-each>
						</xsl:if>
					</xsl:if>
				</xsl:for-each>
			</xsl:result-document>
		</xsl:for-each-group>
		
		<xsl:apply-templates select="$unattached"/>
		
		<xsl:text>&#x0a;</xsl:text>
	</xsl:template>

	<xsl:template match="table">
		<xsl:param name="path" as="xs:string"
			select="concat('no-path/', column[@name='alias'])"
		/>
		<xsl:param name="subMenu"/>
		<xsl:result-document href="../{$path}.html" method="text">
			<xsl:text>---&#x0a;</xsl:text>
			<xsl:value-of select="concat('title: ', column[@name='title'], '&#x0a;')"/>
			<xsl:if test="exists($subMenu)">
				<xsl:value-of select="concat('subMenu: ', $subMenu, '&#x0a;')"/>
			</xsl:if>
			<xsl:text>---&#x0a;</xsl:text>
			<xsl:value-of select="column[@name='introtext']"/>
		</xsl:result-document>
	</xsl:template>

</xsl:stylesheet>
